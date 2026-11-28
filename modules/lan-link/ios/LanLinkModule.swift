import ExpoModulesCore
import Network

/// The mDNS (DNS-SD) service type the host advertises its session under. Apple calls mDNS
/// "Bonjour": the type is declared in app.json under NSBonjourServices.
private let serviceType = "_lineo._tcp"
/// A connection that is not up after this long is given up (host gone, wrong network).
private let connectTimeout: TimeInterval = 5
/// A line longer than this is not one of ours: the connection is closed.
private let maxLineBytes = 1_000_000
private let newline: UInt8 = 0x0A

public final class LanLinkModule: Module {
  /// Everything below runs on this queue: the listener, the connections and their state.
  private let queue = DispatchQueue(label: "app.lineo.lan-link")
  private var listener: NWListener?
  /// The mDNS name to announce: given before `listen`, set on the listener before it starts.
  private var service: NWListener.Service?
  private var peers: [String: Peer] = [:]

  public func definition() -> ModuleDefinition {
    Name("LanLink")
    Events("onOpen", "onLine", "onClose")

    AsyncFunction("listen") { (port: Int, promise: Promise) in
      self.queue.async { self.listen(port: port, promise: promise) }
    }

    Function("stopListening") {
      self.queue.async {
        self.listener?.cancel()
        self.listener = nil
      }
    }

    Function("addresses") { () -> [String] in
      localAddresses()
    }

    // mDNS: the listener announces the session by name, a guest with no address finds it
    Function("advertise") { (name: String) in
      self.queue.async {
        self.service = NWListener.Service(name: name, type: serviceType)
        self.listener?.service = self.service
      }
    }

    Function("stopAdvertising") {
      self.queue.async {
        self.service = nil
        self.listener?.service = nil
      }
    }

    AsyncFunction("connect") { (host: String, port: Int, promise: Promise) in
      self.queue.async {
        guard let endpointPort = NWEndpoint.Port(rawValue: UInt16(clamping: port)) else {
          promise.reject("ERR_CONNECT", "Bad port \(port)")
          return
        }
        self.connect(to: .hostPort(host: NWEndpoint.Host(host), port: endpointPort), promise: promise)
      }
    }

    // Network.framework resolves the service itself: no browsing, no address needed
    AsyncFunction("connectService") { (name: String, promise: Promise) in
      self.queue.async {
        self.connect(
          to: .service(name: name, type: serviceType, domain: "local.", interface: nil),
          promise: promise)
      }
    }

    Function("send") { (id: String, line: String) in
      self.queue.async { self.peers[id]?.send(line) }
    }

    Function("close") { (id: String) in
      self.queue.async { self.peers[id]?.connection.cancel() }
    }

    // Routing through the Wi-Fi is an Android problem: iOS sends local addresses to the Wi-Fi
    AsyncFunction("bindToWifi") { () -> Bool in true }
    Function("unbindWifi") {}

    OnDestroy {
      self.queue.async {
        self.listener?.cancel()
        self.listener = nil
        for peer in self.peers.values { peer.connection.cancel() }
      }
    }
  }

  private func listen(port: Int, promise: Promise) {
    listener?.cancel()
    let parameters = NWParameters.tcp
    parameters.allowLocalEndpointReuse = true
    let endpointPort: NWEndpoint.Port? =
      port == 0 ? .any : NWEndpoint.Port(rawValue: UInt16(clamping: port))
    guard let endpointPort, let listener = try? NWListener(using: parameters, on: endpointPort)
    else {
      promise.reject("ERR_LISTEN", "Cannot listen on port \(port)")
      return
    }
    self.listener = listener
    listener.service = service
    var settled = false
    listener.stateUpdateHandler = { state in
      guard !settled else { return }
      switch state {
      case .ready:
        settled = true
        promise.resolve(Int(listener.port?.rawValue ?? 0))
      case .failed(let error):
        settled = true
        promise.reject("ERR_LISTEN", error.localizedDescription)
      default:
        break
      }
    }
    listener.newConnectionHandler = { [weak self] connection in
      self?.adopt(connection, inbound: true, onReady: nil)
    }
    listener.start(queue: queue)
  }

  private func connect(to endpoint: NWEndpoint, promise: Promise) {
    let connection = NWConnection(to: endpoint, using: .tcp)
    var settled = false
    let id = adopt(connection, inbound: false) { ready, id in
      guard !settled else { return }
      settled = true
      if ready { promise.resolve(id) } else { promise.reject("ERR_CONNECT", "Cannot reach the host") }
    }
    // While iOS asks for the local network permission the connection waits: give up after a
    // while, the guest tries again
    queue.asyncAfter(deadline: .now() + connectTimeout) { [weak self] in
      guard !settled else { return }
      settled = true
      self?.peers[id]?.connection.cancel()
      promise.reject("ERR_CONNECT", "Timed out reaching the host")
    }
  }

  /// Keeps a connection, reads its lines, tells JS when it opens and closes.
  @discardableResult
  private func adopt(
    _ connection: NWConnection, inbound: Bool, onReady: ((Bool, String) -> Void)?
  ) -> String {
    let id = UUID().uuidString
    let peer = Peer(id: id, connection: connection)
    peers[id] = peer
    var closed = false
    // Weak peer: it owns the connection, which owns this handler
    connection.stateUpdateHandler = { [weak self, weak peer] state in
      guard let self else { return }
      switch state {
      case .ready:
        onReady?(true, id)
        self.sendEvent("onOpen", ["id": id, "inbound": inbound])
        if let peer { self.read(peer) }
      case .failed, .cancelled:
        onReady?(false, id)
        self.peers[id] = nil
        if !closed {
          closed = true
          self.sendEvent("onClose", ["id": id])
        }
      default:
        break
      }
    }
    connection.start(queue: queue)
    return id
  }

  private func read(_ peer: Peer) {
    peer.connection.receive(minimumIncompleteLength: 1, maximumLength: 65_536) {
      [weak self] data, _, isComplete, error in
      guard let self else { return }
      if let data {
        peer.buffer.append(data)
        while let end = peer.buffer.firstIndex(of: newline) {
          let line = String(decoding: peer.buffer[peer.buffer.startIndex..<end], as: UTF8.self)
          peer.buffer = Data(peer.buffer[(end + 1)...])
          self.sendEvent("onLine", ["id": peer.id, "line": line])
        }
        if peer.buffer.count > maxLineBytes {
          peer.connection.cancel()
          return
        }
      }
      if isComplete || error != nil {
        peer.connection.cancel()
        return
      }
      self.read(peer)
    }
  }
}

private final class Peer {
  let id: String
  let connection: NWConnection
  var buffer = Data()

  init(id: String, connection: NWConnection) {
    self.id = id
    self.connection = connection
  }

  func send(_ line: String) {
    var data = Data(line.utf8)
    data.append(newline)
    connection.send(content: data, completion: .contentProcessed { _ in })
  }
}

/// Private IPv4 addresses of the Wi-Fi (en*) and personal hotspot (bridge*) interfaces.
private func localAddresses() -> [String] {
  var result: [String] = []
  var list: UnsafeMutablePointer<ifaddrs>?
  guard getifaddrs(&list) == 0, let first = list else { return result }
  defer { freeifaddrs(list) }
  for pointer in sequence(first: first, next: { $0.pointee.ifa_next }) {
    let entry = pointer.pointee
    guard let address = entry.ifa_addr, address.pointee.sa_family == UInt8(AF_INET) else {
      continue
    }
    let flags = Int32(entry.ifa_flags)
    guard flags & IFF_UP != 0, flags & IFF_LOOPBACK == 0 else { continue }
    let name = String(cString: entry.ifa_name)
    guard name.hasPrefix("en") || name.hasPrefix("bridge") else { continue }
    var host = [CChar](repeating: 0, count: Int(NI_MAXHOST))
    guard
      getnameinfo(
        address, socklen_t(address.pointee.sa_len), &host, socklen_t(host.count), nil, 0,
        NI_NUMERICHOST) == 0
    else { continue }
    let ip = String(cString: host)
    if isPrivate(ip), !result.contains(ip) { result.append(ip) }
  }
  return result
}

/// 10/8, 172.16/12, 192.168/16: a local network. Not 169.254 (no network at all).
private func isPrivate(_ ip: String) -> Bool {
  let parts = ip.split(separator: ".").compactMap { Int($0) }
  guard parts.count == 4 else { return false }
  return parts[0] == 10 || (parts[0] == 172 && (16...31).contains(parts[1]))
    || (parts[0] == 192 && parts[1] == 168)
}

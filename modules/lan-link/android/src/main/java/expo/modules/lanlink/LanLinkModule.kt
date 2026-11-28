package expo.modules.lanlink

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import android.os.Build
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.ByteArrayOutputStream
import java.net.Inet4Address
import java.net.InetSocketAddress
import java.net.NetworkInterface
import java.net.ServerSocket
import java.net.Socket
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.RejectedExecutionException
import java.util.concurrent.atomic.AtomicBoolean

/** A connection that is not up after this long is given up (host gone, wrong network). */
private const val CONNECT_TIMEOUT_MS = 5_000
/** A line longer than this is not one of ours: the connection is closed (as on iOS). */
private const val MAX_LINE_BYTES = 1_000_000
private const val NEWLINE = '\n'.code.toByte()
/** The mDNS (DNS-SD) service type the host advertises its session under (same as iOS). */
private const val SERVICE_TYPE = "_lineo._tcp"
/** How long a guest looks for the host's mDNS name before giving up (it tries again later). */
private const val DISCOVERY_TIMEOUT_MS = 5_000L
/** How long Android may take to hand over the Wi-Fi network. */
private const val WIFI_REQUEST_MS = 3_000
/** Wi-Fi and hotspot interfaces: not cellular (rmnet, ccmni), not VPN (tun). */
private val LOCAL_INTERFACES = listOf("wlan", "swlan", "ap", "softap", "eth")

class LanLinkModule : Module() {
  /** Accepting, connecting and reading block: each on a thread of its own. */
  private val threads: ExecutorService = Executors.newCachedThreadPool()
  private val peers = ConcurrentHashMap<String, Peer>()
  @Volatile private var server: ServerSocket? = null
  private var wifiCallback: ConnectivityManager.NetworkCallback? = null

  @Volatile private var port = 0
  /** The mDNS name to announce once listening (set by advertise). */
  private var advertisedName: String? = null
  private var registration: NsdManager.RegistrationListener? = null

  private val nsd: NsdManager?
    get() = appContext.reactContext?.getSystemService(Context.NSD_SERVICE) as? NsdManager

  private val connectivity: ConnectivityManager?
    get() =
      appContext.reactContext?.getSystemService(Context.CONNECTIVITY_SERVICE)
        as? ConnectivityManager

  override fun definition() = ModuleDefinition {
    Name("LanLink")
    Events("onOpen", "onLine", "onClose")

    AsyncFunction("listen") { port: Int, promise: Promise ->
      threads.execute {
        try {
          server?.close()
          val listening = ServerSocket(port)
          server = listening
          this@LanLinkModule.port = listening.localPort
          advertisedName?.let { register(it) }
          threads.execute { accept(listening) }
          promise.resolve(listening.localPort)
        } catch (e: Exception) {
          promise.reject("ERR_LISTEN", "Cannot listen on port $port", e)
        }
      }
    }

    Function("stopListening") {
      server?.close()
      server = null
    }

    Function("addresses") { localAddresses() }

    // mDNS: the host announces the session by name, a guest with no address finds it
    Function("advertise") { name: String ->
      advertisedName = name
      if (port != 0) register(name)
    }

    Function("stopAdvertising") {
      advertisedName = null
      unregister()
    }

    AsyncFunction("connectService") { name: String, promise: Promise -> discover(name, promise) }

    AsyncFunction("connect") { host: String, port: Int, promise: Promise ->
      threads.execute {
        try {
          val socket = Socket()
          socket.connect(InetSocketAddress(host, port), CONNECT_TIMEOUT_MS)
          promise.resolve(adopt(socket, inbound = false))
        } catch (e: Exception) {
          promise.reject("ERR_CONNECT", "Cannot reach $host", e)
        }
      }
    }

    Function("send") { id: String, line: String -> peers[id]?.send(line) }

    Function("close") { id: String -> peers[id]?.close() }

    // Without this, a Wi-Fi with no internet loses to mobile data and the host is never reached
    AsyncFunction("bindToWifi") { promise: Promise ->
      val manager = connectivity
      if (manager == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
        promise.resolve(false)
        return@AsyncFunction
      }
      wifiCallback?.let { manager.unregisterNetworkCallback(it) }
      val settled = AtomicBoolean(false)
      val callback =
        object : ConnectivityManager.NetworkCallback() {
          override fun onAvailable(network: Network) {
            manager.bindProcessToNetwork(network)
            if (settled.compareAndSet(false, true)) promise.resolve(true)
          }

          override fun onUnavailable() {
            if (settled.compareAndSet(false, true)) promise.resolve(false)
          }
        }
      wifiCallback = callback
      val request =
        NetworkRequest.Builder().addTransportType(NetworkCapabilities.TRANSPORT_WIFI).build()
      manager.requestNetwork(request, callback, WIFI_REQUEST_MS)
    }

    Function("unbindWifi") { unbindWifi() }

    OnDestroy {
      unregister()
      server?.close()
      server = null
      peers.values.forEach { it.close() }
      unbindWifi()
      threads.shutdownNow()
    }
  }

  private fun register(name: String) {
    val manager = nsd ?: return
    unregister()
    val info =
      NsdServiceInfo().apply {
        serviceName = name
        serviceType = SERVICE_TYPE
        port = this@LanLinkModule.port
      }
    val listener =
      object : NsdManager.RegistrationListener {
        override fun onServiceRegistered(info: NsdServiceInfo) {}
        override fun onRegistrationFailed(info: NsdServiceInfo, error: Int) {}
        override fun onServiceUnregistered(info: NsdServiceInfo) {}
        override fun onUnregistrationFailed(info: NsdServiceInfo, error: Int) {}
      }
    registration = listener
    manager.registerService(info, NsdManager.PROTOCOL_DNS_SD, listener)
  }

  private fun unregister() {
    val listener = registration ?: return
    registration = null
    try {
      nsd?.unregisterService(listener)
    } catch (e: Exception) {}
  }

  /** Finds the host's mDNS name, resolves its address, and connects to it. */
  @Suppress("DEPRECATION") // resolveService: its replacement needs API 34
  private fun discover(name: String, promise: Promise) {
    val manager = nsd
    if (manager == null) {
      promise.reject("ERR_CONNECT", "No network service discovery", null)
      return
    }
    val settled = AtomicBoolean(false)
    lateinit var discovery: NsdManager.DiscoveryListener
    val fail = { message: String ->
      if (settled.compareAndSet(false, true)) {
        try {
          manager.stopServiceDiscovery(discovery)
        } catch (e: Exception) {}
        promise.reject("ERR_CONNECT", message, null)
      }
    }
    discovery =
      object : NsdManager.DiscoveryListener {
        override fun onServiceFound(info: NsdServiceInfo) {
          if (info.serviceName != name || settled.get()) return
          manager.resolveService(
            info,
            object : NsdManager.ResolveListener {
              override fun onServiceResolved(resolved: NsdServiceInfo) {
                val host = resolved.host?.hostAddress ?: return fail("No address for $name")
                if (!settled.compareAndSet(false, true)) return
                try {
                  manager.stopServiceDiscovery(discovery)
                } catch (e: Exception) {}
                threads.execute {
                  try {
                    val socket = Socket()
                    socket.connect(InetSocketAddress(host, resolved.port), CONNECT_TIMEOUT_MS)
                    promise.resolve(adopt(socket, inbound = false))
                  } catch (e: Exception) {
                    promise.reject("ERR_CONNECT", "Cannot reach $name", e)
                  }
                }
              }

              override fun onResolveFailed(info: NsdServiceInfo, error: Int) =
                fail("Cannot resolve $name")
            },
          )
        }

        override fun onServiceLost(info: NsdServiceInfo) {}
        override fun onDiscoveryStarted(type: String) {}
        override fun onDiscoveryStopped(type: String) {}
        override fun onStartDiscoveryFailed(type: String, error: Int) = fail("Discovery failed")
        override fun onStopDiscoveryFailed(type: String, error: Int) {}
      }
    manager.discoverServices(SERVICE_TYPE, NsdManager.PROTOCOL_DNS_SD, discovery)
    threads.execute {
      Thread.sleep(DISCOVERY_TIMEOUT_MS)
      fail("$name not found")
    }
  }

  private fun unbindWifi() {
    val manager = connectivity ?: return
    wifiCallback?.let { manager.unregisterNetworkCallback(it) }
    wifiCallback = null
    manager.bindProcessToNetwork(null)
  }

  private fun accept(listening: ServerSocket) {
    while (!listening.isClosed) {
      try {
        adopt(listening.accept(), inbound = true)
      } catch (e: Exception) {
        return // closed by stopListening
      }
    }
  }

  /** Keeps a connection, reads its lines on a thread, tells JS when it opens and closes. */
  private fun adopt(socket: Socket, inbound: Boolean): String {
    socket.tcpNoDelay = true
    val id = UUID.randomUUID().toString()
    val peer = Peer(id, socket)
    peers[id] = peer
    sendEvent("onOpen", mapOf("id" to id, "inbound" to inbound))
    threads.execute {
      try {
        readLines(socket, id)
      } catch (e: Exception) {
        // broken or closed: same ending
      }
      peer.close()
    }
    return id
  }

  /**
   * Reads line by line, with a cap: before JS can check the session key, anyone on the network
   * may connect, and an endless line must not fill the memory.
   */
  private fun readLines(socket: Socket, id: String) {
    val input = socket.getInputStream()
    val line = ByteArrayOutputStream()
    val buffer = ByteArray(8192)
    while (true) {
      val count = input.read(buffer)
      if (count < 0) return
      var start = 0
      for (i in 0 until count) {
        if (buffer[i] != NEWLINE) continue
        line.write(buffer, start, i - start)
        sendEvent("onLine", mapOf("id" to id, "line" to String(line.toByteArray(), Charsets.UTF_8)))
        line.reset()
        start = i + 1
      }
      line.write(buffer, start, count - start)
      if (line.size() > MAX_LINE_BYTES) return
    }
  }

  private inner class Peer(val id: String, private val socket: Socket) {
    /** Writes in order, off the JS thread. */
    private val writer: ExecutorService = Executors.newSingleThreadExecutor()
    private val closed = AtomicBoolean(false)

    fun send(line: String) {
      if (closed.get()) return
      try {
        writer.execute {
          try {
            socket.getOutputStream().apply {
              write("$line\n".toByteArray(Charsets.UTF_8))
              flush()
            }
          } catch (e: Exception) {
            close()
          }
        }
      } catch (e: RejectedExecutionException) {
        // closed by the reader at the same moment: nothing to send to any more
      }
    }

    fun close() {
      if (!closed.compareAndSet(false, true)) return
      peers.remove(id)
      writer.shutdown()
      try {
        socket.close()
      } catch (e: Exception) {}
      sendEvent("onClose", mapOf("id" to id))
    }
  }
}

/** Private IPv4 addresses of the Wi-Fi and hotspot interfaces. */
private fun localAddresses(): List<String> {
  val result = mutableListOf<String>()
  val interfaces = NetworkInterface.getNetworkInterfaces() ?: return result
  for (network in interfaces) {
    if (!network.isUp || network.isLoopback) continue
    if (LOCAL_INTERFACES.none { network.name.startsWith(it) }) continue
    for (address in network.inetAddresses) {
      if (address is Inet4Address && address.isSiteLocalAddress) {
        val ip = address.hostAddress ?: continue
        if (ip !in result) result.add(ip)
      }
    }
  }
  return result
}

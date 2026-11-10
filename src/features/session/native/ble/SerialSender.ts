/** Sends packets one after the other: BLE keeps them in order only if we wait for each. */
export class SerialSender {
  private chain: Promise<unknown> = Promise.resolve();

  send(chunks: string[], write: (chunk: string) => Promise<void>) {
    for (const chunk of chunks) {
      this.chain = this.chain.then(() => write(chunk)).catch((e) => console.warn('BLE send', e));
    }
  }
}

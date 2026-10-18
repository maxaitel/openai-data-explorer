import { JSONParser } from '@streamparser/json'
import { addJSON, type ArchiveRecord } from './model'

export const isConversationFile = (name: string) => /^(conversations|codex)(-\d+)?\.json$/i.test(name.split('/').at(-1) || '')

/** Decode and parse incrementally, releasing each conversation from the parser stack. */
export function jsonSink(records: ArchiveRecord[], name: string, onBytes: (bytes: number) => void = () => {}) {
  const decoder = new TextDecoder('utf-8', { fatal: true })
  let parser: JSONParser | undefined
  let row = 0
  let bytes = 0
  function feed(text: string) {
    if (!parser) {
      text = text.trimStart()
      if (!text) return
      const conversations = isConversationFile(name)
      parser = new JSONParser({ paths: conversations ? [text[0] === '[' ? '$.*' : '$.conversations.*'] : ['$'], keepStack: false, stringBufferSize: 64 * 1024 })
      parser.onValue = ({ value }) => {
        if (conversations) addJSON(records, name, [value], row++)
        else addJSON(records, name, value)
      }
    }
    parser.write(text)
  }
  return new WritableStream<Uint8Array>({
    write(chunk) {
      feed(decoder.decode(chunk, { stream: true }))
      bytes += chunk.byteLength
      onBytes(bytes)
    },
    close() {
      feed(decoder.decode())
      if (!parser) throw new Error('Empty JSON file.')
      if (!parser.isEnded) parser.end()
    },
  })
}

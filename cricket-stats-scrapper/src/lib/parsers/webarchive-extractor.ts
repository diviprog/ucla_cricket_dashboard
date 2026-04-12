import * as bplist from 'bplist-parser'

/**
 * Extract HTML from Apple WebArchive file
 * @param buffer - ArrayBuffer or Buffer containing the webarchive data
 * @returns Extracted HTML string
 * @throws Error if webarchive cannot be parsed
 */
export async function extractHTMLFromWebArchive(buffer: ArrayBuffer | Buffer): Promise<string> {
  // Convert ArrayBuffer to Buffer if needed
  // Handle both Node.js Buffer and browser ArrayBuffer
  let nodeBuffer: Buffer
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(buffer)) {
    nodeBuffer = buffer
  } else {
    // Browser environment or ArrayBuffer
    if (typeof Buffer !== 'undefined') {
      nodeBuffer = Buffer.from(buffer as ArrayBuffer)
    } else {
      // Fallback for pure browser environment without Buffer polyfill
      throw new Error('Buffer is not available. Please ensure the environment supports Buffer.')
    }
  }

  try {
    // Parse binary plist
    const parsed = await bplist.parseBuffer(nodeBuffer)

    if (!parsed || !Array.isArray(parsed) || parsed.length < 1) {
      throw new Error('Failed to parse webarchive file - empty result')
    }

    const webarchive = parsed[0] as any

    // Extract HTML from WebMainResource
    const mainResource = webarchive.WebMainResource
    if (!mainResource) {
      throw new Error('No WebMainResource found in webarchive')
    }

    if (!mainResource.WebResourceData) {
      throw new Error('No WebResourceData found in WebMainResource')
    }

    // Convert Buffer to string
    const html = mainResource.WebResourceData.toString('utf-8')

    if (!html || html.trim().length === 0) {
      throw new Error('Extracted HTML is empty')
    }

    return html
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to extract HTML from webarchive: ${error.message}`)
    }
    throw new Error('Failed to extract HTML from webarchive: Unknown error')
  }
}

/**
 * Check if filename is a webarchive
 */
export function isWebArchive(filename: string): boolean {
  return filename.toLowerCase().endsWith('.webarchive')
}

/**
 * Get a user-friendly error message for webarchive issues
 */
export function getWebArchiveErrorMessage(error: Error): string {
  const message = error.message.toLowerCase()

  if (message.includes('empty')) {
    return 'The webarchive file appears to be empty or corrupted. Please try downloading the page again.'
  }

  if (message.includes('webmainresource') || message.includes('webresourcedata')) {
    return 'Invalid webarchive format. Make sure you saved the page as a Web Archive (.webarchive) in Safari.'
  }

  return `Error processing webarchive file: ${error.message}`
}

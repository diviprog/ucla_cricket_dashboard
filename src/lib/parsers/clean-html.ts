import * as cheerio from 'cheerio'

/** Over this, the page is not a scorecard we should send to the model. */
const MAX_CHARS = 200_000

const squash = (s: string) => s.replace(/\s+/g, ' ').trim()

/**
 * Reduce a saved scorecard page to compact text for the model:
 * tables become one line per row ("cell | cell | cell"), everything else one line per text run.
 * Layout-agnostic on purpose; no site-specific selectors.
 */
export function cleanScorecardHtml(html: string): string {
  const $ = cheerio.load(html)
  const title = squash($('title').first().text())
  const savedFrom = html.match(/saved from url=\(\d+\)(\S+)/)?.[1]
  const url = $('meta[property="og:url"]').attr('content') || $('link[rel="canonical"]').attr('href') || savedFrom

  $('script, style, svg, noscript, iframe, img, link, template, head').remove()

  // Dates often live only in <time datetime="...">
  $('time[datetime]').each((_, el) => {
    $(el).text(`${$(el).text()} (${$(el).attr('datetime')})`)
  })

  // Text runs inside a node, kept apart so "Name" and "b Bowler" in one cell do not fuse
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const runs = (node: any): string[] => {
    const out: string[] = []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const walk = (n: any) => {
      if (n.type === 'text') {
        const t = squash(n.data || '')
        if (t) out.push(t)
      } else if (n.children) {
        n.children.forEach(walk)
      }
    }
    walk(node)
    return out
  }

  // Innermost tables first, so nested layout tables do not swallow the real ones
  $('table')
    .toArray()
    .reverse()
    .forEach(table => {
      const rows = $(table)
        .find('tr')
        .toArray()
        .map(tr =>
          $(tr)
            .children('th, td')
            .toArray()
            .map(cell => runs(cell).join(' / '))
            .join(' | ')
        )
        .filter(r => r.replace(/[|\s]/g, '') !== '')
      $(table).replaceWith(`\n[TABLE]\n${rows.join('\n')}\n[/TABLE]\n`)
    })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const roots: any[] = $('body').length ? $('body').toArray() : $.root().toArray()
  const lines: string[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const walk = (n: any) => {
    if (n.type === 'text') {
      for (const raw of String(n.data || '').split('\n')) {
        const t = squash(raw)
        if (t && t !== lines[lines.length - 1]) lines.push(t)
      }
    } else if (n.children) {
      n.children.forEach(walk)
    }
  }
  roots.forEach(walk)

  const header = [title && `Page title: ${title}`, url && `Source URL: ${url}`].filter((l): l is string => !!l)
  const text = [...header, '', ...lines].join('\n')
  if (text.length > MAX_CHARS) {
    throw new Error(`Page text is ${text.length} characters after cleaning, too large to be a single scorecard`)
  }
  return text
}

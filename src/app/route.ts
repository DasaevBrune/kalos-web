import { readFileSync } from 'fs'
import { join } from 'path'

export async function GET() {
  const html = readFileSync(join(process.cwd(), 'public', 'landing.html'), 'utf-8')
  return new Response(html, {
    headers: { 'content-type': 'text/html; charset=utf-8' },
  })
}

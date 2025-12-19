import { Hono } from 'hono'

const app = new Hono()

app.get('/ping', (c) => {
  return c.text('Pong!')
})

export default app

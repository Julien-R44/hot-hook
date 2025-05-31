import type { FC } from 'hono/jsx'

import { Button } from '../components/button.js'

/**
 * Try updating the return value of this component and refreshing the page.
 * You will always get the latest version of the code without
 * restarting the whole server.
 */
export const Home: FC = () => {
  return (
    <html>
      <body>
        <p>Hello</p>
        <Button />
      </body>
    </html>
  )
}

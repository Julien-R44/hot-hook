import { FC } from 'hono/jsx'

/**
 * Try updating the return value of this component and refreshing the page.
 * You will always get the latest version of the code without
 * restarting the whole server.
 */
export const Home: FC = (props) => {
  return (
    <html>
      <body>Hello world</body>
    </html>
  )
}

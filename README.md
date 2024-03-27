# Hot Hook

Hot Hook est une librairie simple et légère qui permet d'avoir du hot module reloading dans NodeJS avec de l'ESM.

Vous voyez le hot module reloading dans les frameworks comme React ou VueJS où vous modifiez un fichier et la page se met à jour automatiquement sans avoir à rafraîchir la page ? Et bien c'est le meme concept mais pour NodeJS. 

Prenez un serveur Express par exemple, jusqu'à présent le processus le plus répandu de développement était de watcher l'intégralité du projet avec des outils comme nodemon ou chokidar, et de redémarrer la totalité du serveur dès lors qu'un fichier changeait. Avec Hot Hook, vous n'avez plus besoin de redémarrer tout le serveur, vous pouvez faire en sorte que seulement le module/fichier qui a changé soit rechargé. Ce qui procure une DX et une feedback loop bien plus rapide.

La librairie est désigné pour etre très légère et simple. Elle ne fait pas de magie noire, pas de parsing AST, pas de transformation de code, pas de bundling. On se contente juste de recharger le module qui a changé.

## Installation

```bash
pnpm add hot-hook
```

Une fois installé, vous devez ajouter le code suivant le plus tôt possible dans votre application NodeJS.

```ts
import { hot } from 'hot-hook'

await hot.init(import.meta.url, {
  // options
})
```

## Utilisation

Une fois Hot Hook initialisé dans votre application, il vous faudra utiliser des `await import()` aux endroits ou vous souhaitez bénéficier du hot module reloading. 

```ts
import * as http from 'http'

const server = http.createServer(async (request, response) => {
  const app = await import('./app.js')
  app.default(request, response)
})

server.listen(8080)
```

C'est un exemple simple, mais ci-dessus, le module `app.js` sera toujours rechargé avec la dernière version à chaque fois que vous modifierez le fichier. Cependant, le serveur http ne sera pas redémarré. 

On a quelques exemples dans le dossier `examples` avec différents frameworks pour vous aider à setup Hot Hook dans votre application. **Si vous utilisez [AdonisJS](https://adonisjs.com/)** : c'est votre jour de chance. Hot-hook est intégré dans AdonisJS et a d'ailleurs été la raison pour laquelle j'ai créé cette librairie.

## Options

`hot.init` accepte les options suivantes:

- `reload` : Un tableau de glob patterns qui permet de spécifier quels fichiers doivent trigger un full reload du processus.

## API

### import.meta.hot

La variable `import.meta.hot` est disponible si vous avez besoin de conditionner du code en fonction de si hot-hook est activé ou non.

```
if (import.meta.hot) {
  // code spécifique pour le hot module reloading
}
```

### import.meta.hot.dispose()

`import.meta.hot.dispose` est une fonction qui permet de spécifier du code qui doit être exécuté avant qu'un module soit rechargé. Cela peut etre utile pour fermer des connexions, nettoyer des ressources, etc.

```ts
const interval = setInterval(() => {
  console.log('Hello')
}, 1000)

import.meta.hot?.dispose(() => {
  clearInterval(interval)
})
```

Ici, à chaque fois que le module sera rechargé, le `interval` sera nettoyé.

### import.meta.hot.decline()

`import.meta.hot.decline` est une fonction qui permet de spécifier que le module ne doit pas etre rechargé. Cela peut etre utile pour des modules qui ne sont pas sensés etre hot rechargés comme des fichiers de configuration.

```ts
import.meta.hot?.decline()

export const config = {
  port: 8080
}
```

Si jamais ce fichier est modifié, alors hot hook appellera la fonction `onFullReloadAsked` que vous pouvez spécifier dans les options de `hot.init`.

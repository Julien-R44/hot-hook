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
import { hot } from 'esm-hot-reload/adonisjs'

await hot.init(import.meta.url, {
  // options
})
```

## Utilisation

```ts
import fastify from 'fastify'

const app = fastify()





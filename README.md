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


## How it works ?

Premièrement, commencons par expliquer les fondamentaux.

### What is a hook ? 

Hot Hook est un [hook](https://nodejs.org/api/module.html#customization-hooks) pour Node.js. En quelques mots : un hook est un moyen d'intercepter le chargement d'un module. à chaque fois, dans votre code, que vous faites un `import`, Hot hook est en mesure d'intercepter cela et de faire des actions supplémentaires comme injecter ou transformer le code du module importé, enregistrer des informations sur le module, etc.

### ESM Cache busting

Dès lors que vous utilisez un `import`, Node.js charge le module en mémoire et le garde en cache. Cela signifie que si vous importez ce meme module plusieurs fois dans votre application, Node.js ne le chargera qu'une seule fois et cela tout au long de la durée de vie de l'application.

Ce qui est embetant pour avoir du hot module reloading.

Avant, grace au CommonJS ( `require` ), on avait la main sur ce cache de Node.js. On avait la possibilité de supprimer un module du cache ( `delete require.cache` ), et donc un `require` sur ce module forcerait Node.js à récupérer la dernière version du module.

Donc, comment on fait ça en ESM ? Il y a des tas de discussions sur ce sujet depuis un moment ( https://github.com/nodejs/node/issues/49442, https://github.com/nodejs/help/issues/2806 ). Mais pour l'instant, il n'y a pas de solution officielle. Cependant il existe un trick. Un trick qui cause des memory leaks, mais qui sont tellement minimes que cela ne devrait pas poser de problèmes pour la plupart des applications. D'autant plus qu'on se sert de ce trick SEULEMENT en mode développement.

C'est de ce trick que Hot Hook se sert pour faire du hot module reloading. Et cela consiste à juste ajouter un query parameter à l'url du module importé. Cela force Node.js à charger le module à nouveau et donc à avoir la dernière version du module.

```ts
await import('./app.js?v=1')
await sleep(5_000)
await import('./app.js?v=2')
```

Si vous executez ce code, et qu'entre les deux imports vous modifiez le fichier `app.js`, alors le deuxième import chargera la dernière version du module que vous avez sauvegardé.

### Hot Hook

Avec tout ça, Hot Hook est finalement assez simple : 

- On intercepte les imports avec un hook
- On watch tous les fichiers du projet et on build un arbre de dépendances pour chaque module
- Si jamais un fichier change, alors on augmente le query parameter de l'url du module importé
- Et donc la prochaine fois que le module est importé, Node.js chargera la dernière version du module

Simple, léger, et efficace.

## Limitations

### Full reload

Pour les full reloads, il vous faudra utiliser un genre de manager de process pour redémarrer le processus. Hot hook ne le fait pas pour vous. Si il y a des demandes on pourra peut etre ajouter cette fonctionnalité.

En attendant, il y a des tas de solutions simple pour ça : spawner votre application en tant que child process, utiliser des outils comme nodemon, des worker threads, etc. 

Par exemple, sur AdonisJS, on utilise un 

Ici un simple exemple avec des clusters Nodejs : 

```ts
// title: dev-server.ts

if (cluster.isPrimary) {
  cluster.fork()
  cluster.on('exit', (worker, code) => {
    console.log(`[master] worker #${worker.id} down, restarting\n`)
    cluster.fork()
  })

  process.on('SIGINT', () => {})
} else {
  await hot.init({
    reload: ['./index.tsx'],
    onFullReloadAsked: () => {
      process.kill(process.pid, 'SIGTERM')
    },
  })
  process.on('SIGINT', () => {
    console.log(`[worker#${cluster.worker.id}] SIGINT received! dying gracefully !\n`)
    process.exit(0)
  })

  console.log(`new worker #${cluster.worker.id}`)

  const { run } = await import('my-app.js')
  run()

}
```

Notez l'utilisation de `onFullReloadAsked` de `hot.init`. Votre callback sera executé dès lors qu'un full reload est demandé par hot-hook. Dans cet exemple, on tue le processus avec `process.kill` et on laisse le cluster manager redémarrer un nouveau processus.


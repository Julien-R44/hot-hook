---
'hot-hook': minor
---

Plus tot, avec cette release https://github.com/Julien-R44/hot-hook/releases/tag/hot-hook%400.3.0 on se contentait de throw et donc de killer l'app quand un fichier boundary n'était pas importé dynamiquement car cela empechait à hot-hook de hot-reloader. 

Maintenant, on ne throw plus par défault l'erreur, on emet simplement un message de type "hot-hook:full-reload" au process parent, qui lui sera chargé de restart l'app entière. Ce message "hot-hook:full-reload" n'est pas nouveau, il était déjà utilisé pour les fichiers qui devaient trigger un full reload. 

Si jamais vous souhaitez quand meme throw l'erreur, alors vous pouvez passer l'options `throwWhenBoundariesAreNotDynamicallyImported` à true, quand vous appellez `hot.init` ou dans votre `package.json` : 

```json
{
  "hotHook": {
    "throwWhenBoundariesAreNotDynamicallyImported": true
  }
}
```

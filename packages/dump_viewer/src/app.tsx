import { DataSet } from 'vis-data'
import { useEffect } from 'preact/hooks'
import { Edge, Network, Node } from 'vis-network'

export function App() {
  async function initGraph() {
    const data: HotHookDump = import.meta.env.DEV
      ? // eslint-disable-next-line unicorn/no-await-expression-member
        (await import('./fixtures/dump.json')).default
      : window.__HOT_HOOK_DUMP__
    let nodes: Node[] = []
    let edges: Edge[] = []

    const paths = new Map()

    data.forEach((item, index) => paths.set(item.path, index + 1))
    data.forEach((item, index) => {
      const hasOnlyNodeModulesDependency = item.dependencies.every((dep) =>
        dep.includes('node_modules')
      )

      const isRoot = item.dependents.length === 0

      const id = index + 1

      if (item.path.includes('node_modules') && hasOnlyNodeModulesDependency) {
        return
      }

      let color = 'lightgray'
      if (item.boundary) {
        color = '#fea800'
      } else if (isRoot) {
        color = 'violet'
      } else if (item.reloadable) {
        color = '#72cc0a'
      }

      nodes.push({
        shape: 'box',
        id: id,
        label: `${item.path} | Version ${item.version}`,
        margin: { top: 13, bottom: 13, left: 13, right: 13 },
        borderWidth: 3,
        shadow: true,
        font: { color: 'black' },
        shapeProperties: { borderRadius: 10 },
        color: color,
      })

      item.dependencies.forEach((dep) => {
        const toId = paths.get(dep)
        if (toId) {
          edges.push({ from: id, to: toId, arrows: 'to' })
        } else {
          console.log('Missing node for dependency', dep)
        }
      })
    })

    const nodesDataSet = new DataSet(nodes)
    const edgesDataSet = new DataSet(edges)
    const dataVis = { nodes: nodesDataSet, edges: edgesDataSet }

    const container = document.getElementById('network')!
    new Network(container, dataVis, {
      interaction: { hover: true },
      physics: {
        enabled: true,
        barnesHut: {
          gravitationalConstant: -8000,
          centralGravity: 0.3,
          springLength: 95,
          springConstant: 0.04,
          damping: 0.09,
          avoidOverlap: 0,
        },
      },
    })
  }

  useEffect(() => {
    initGraph()
  }, [])

  return (
    <>
      <div class="z-1 absolute top-0 left-0 border-2 border-[#353535] px-4 pb-3 pt-2 bg-[#3f3f3f] m-4 rounded-lg text-sm">
        <p class="font-bold text-lg">Legend</p>
        <div class="flex items-center mt-2">
          <div class="w-4 h-4 bg-violet mr-2"></div>
          <span>Root entrypoint</span>
        </div>
        <div class="flex items-center">
          <div class="w-4 h-4 bg-[#fea800] mr-2"></div>
          <span>Boundary file</span>
        </div>
        <div class="flex items-center">
          <div class="w-4 h-4 bg-[#72cc0a] mr-2"></div>
          <span>Reloadable</span>
        </div>
        <div class="flex items-center">
          <div class="w-4 h-4 bg-[#D3D3D3] mr-2"></div>
          <span>Not-reloadable</span>
        </div>
      </div>
      <div id="network" class="h-full" />
    </>
  )
}

const prices = { wood: 38, steel: 56, fuel: 84, grain: 24, water: 16 }
const firms = [
  { id: 'aurelia_dev', prod: 10, demand: 8, price: 9000, workers: 10, consume: { wood: 8, steel: 7, water: 10 }, inv: { wood: 240, steel: 220, water: 280 } },
  { id: 'azure_shipping', prod: 9, demand: 8, price: 9500, workers: 9, consume: { fuel: 6, steel: 5, wood: 4 }, inv: { fuel: 180, steel: 160, wood: 140 } },
  { id: 'solara_hotels', prod: 10, demand: 9, price: 7800, workers: 10, consume: { grain: 12, water: 14, wood: 5 }, inv: { grain: 280, water: 300, wood: 160 } },
  { id: 'helix', prod: 8, demand: 7, price: 11000, workers: 8, consume: { steel: 8, fuel: 4, wood: 4 }, inv: { steel: 220, fuel: 140, wood: 120 } },
  { id: 'nova_energy', prod: 9, demand: 8, price: 10000, workers: 9, consume: { fuel: 7, steel: 4, water: 8 }, inv: { fuel: 200, steel: 140, water: 200 } },
  { id: 'orion_foods', prod: 12, demand: 11, price: 6200, workers: 10, consume: { grain: 10, water: 8, fuel: 3 }, inv: { grain: 300, water: 240, fuel: 120 } },
  { id: 'velvet_media', prod: 8, demand: 7, price: 10500, workers: 8, consume: { wood: 6, water: 6, fuel: 3 }, inv: { wood: 180, water: 160, fuel: 100 } },
  { id: 'aurelia_motors', prod: 8, demand: 7, price: 12000, workers: 10, consume: { steel: 9, fuel: 5, wood: 3 }, inv: { steel: 240, fuel: 150, wood: 100 } },
]
for (const f of firms) {
  const produced = f.prod
  let res = 0
  const parts = {}
  for (const [k, v] of Object.entries(f.consume)) {
    const c = produced * v * prices[k]
    parts[k] = Math.round(c)
    res += c
  }
  const inv = Object.values(f.inv).reduce((a, b) => a + b, 0)
  const storage = inv * 0.5
  const labor = f.workers * 500
  const sold = Math.min(produced, f.demand)
  const revenue = sold * f.price
  const cost = res + labor + 300 + storage
  const profit = revenue - cost
  const margin = profit / revenue
  const shares = Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, +(v / cost).toFixed(3)]))
  console.log(JSON.stringify({ id: f.id, revenue, res: Math.round(res), labor, storage, cost: Math.round(cost), profit: Math.round(profit), margin: +margin.toFixed(3), shares }))
}

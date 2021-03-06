import fetch from "node-fetch"

type AGSResponse = {
  daten: [
    [ string, string ]
  ]
}

type AGSItem = [string, string]

type AGSSearchResult = {
  code: string
  name: string
}

export default class AGSSearch {
  items?: AGSItem[]

  search(searchedName: string) : AGSSearchResult[] {
    if (!this.items) return []

    const regexp = new RegExp(searchedName, "i")

    return this.items
      .filter(([_, name]) => regexp.test(name))
      .map(([code, name]) => {
        return { code, name }
      })
  }

  get(searchedCode: string) : AGSSearchResult | undefined {
    if (!this.items) return
    const item = this.items
      .find(([code, _]) => code === searchedCode)
    if (item)
      return { code: item[0], name: item[1] }
  }

  async update() : Promise<void> {
    const response = await fetch(
      "https://www.xrepository.de/api/xrepository/urn:de:bund:destatis:bevoelkerungsstatistik:schluessel:rs_2021-08-31/download/Regionalschl_ssel_2021-08-31.json",
      {
        headers: {
          "Accept": "application/json"
        }
      }
    )
    const json = (await response.json()) as AGSResponse

    this.items = json.daten
  }
}
const numberFmt = new Intl.NumberFormat("ja-JP");

class GbifMegaDataPulse extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <section class="pulse">
        <div class="toolbar">
          <div class="field">
            <label for="country">国</label>
            <select id="country">
              <option value="JP">日本</option>
              <option value="US">アメリカ</option>
              <option value="BR">ブラジル</option>
              <option value="AU">オーストラリア</option>
              <option value="ZA">南アフリカ</option>
            </select>
          </div>
          <div class="field">
            <label for="basis">記録タイプ</label>
            <select id="basis">
              <option value="HUMAN_OBSERVATION">Human observation</option>
              <option value="PRESERVED_SPECIMEN">Preserved specimen</option>
              <option value="MACHINE_OBSERVATION">Machine observation</option>
              <option value="">すべて</option>
            </select>
          </div>
          <button id="reload">データ更新</button>
        </div>

        <div class="grid">
          <article class="metric"><h3>対象データ規模</h3><p id="m-global">-</p></article>
          <article class="metric"><h3>選択条件の件数</h3><p id="m-filtered">-</p></article>
          <article class="metric"><h3>過去10年の増加率</h3><p id="m-growth">-</p></article>
          <article class="metric"><h3>最新年の観測数</h3><p id="m-latest">-</p></article>
        </div>

        <div class="canvas-wrap">
          <canvas id="chart" width="960" height="280" aria-label="年間観測数推移"></canvas>
        </div>

        <div>
          <table class="table">
            <thead>
              <tr><th>Top Species</th><th>Record Count</th></tr>
            </thead>
            <tbody id="species-body"></tbody>
          </table>
        </div>

        <p class="status" id="status">GBIF APIへ接続中...</p>
        <p class="small">データソース: GBIF Occurrence API（無料・公開、総レコード30億件超）</p>
      </section>
    `;

    this.countryEl = this.querySelector("#country");
    this.basisEl = this.querySelector("#basis");
    this.reloadBtn = this.querySelector("#reload");
    this.statusEl = this.querySelector("#status");
    this.chart = this.querySelector("#chart");
    this.ctx = this.chart.getContext("2d");

    this.reloadBtn.addEventListener("click", () => this.load());
    this.countryEl.addEventListener("change", () => this.load());
    this.basisEl.addEventListener("change", () => this.load());

    this.load();
  }

  async load() {
    const country = this.countryEl.value;
    const basis = this.basisEl.value;

    try {
      this.setStatus("読み込み中...", false);
      this.reloadBtn.disabled = true;

      const liveData = await this.fetchLiveData(country, basis);
      this.renderAll(liveData);
      this.setStatus(
        `更新完了: ${country} / ${basis || "ALL"} の可視化を反映 (${new Date().toLocaleTimeString("ja-JP")})`,
        false
      );
    } catch (error) {
      const demoData = this.buildDemoData(country, basis);
      this.renderAll(demoData);
      this.setStatus(
        `GBIF APIに接続できなかったためデモデータを表示中（ブラウザ確認は可能）: ${error.message}`,
        true
      );
    } finally {
      this.reloadBtn.disabled = false;
    }
  }

  async fetchLiveData(country, basis) {
    const query = new URLSearchParams({ country, limit: "0" });
    if (basis) query.set("basisOfRecord", basis);

    const [globalRes, filteredRes, yearlyData, speciesData] = await Promise.all([
      fetch("https://api.gbif.org/v1/occurrence/search?limit=0"),
      fetch(`https://api.gbif.org/v1/occurrence/search?${query.toString()}`),
      this.fetchYearly(country, basis),
      this.fetchTopSpecies(country, basis)
    ]);

    if (!globalRes.ok || !filteredRes.ok) {
      throw new Error("APIレスポンス異常");
    }

    const globalJson = await globalRes.json();
    const filteredJson = await filteredRes.json();

    return {
      globalCount: globalJson.count,
      filteredCount: filteredJson.count,
      yearlyData,
      speciesData
    };
  }

  buildDemoData(country, basis) {
    const countryFactor = { JP: 1.0, US: 1.35, BR: 1.18, AU: 1.12, ZA: 0.92 }[country] || 1;
    const basisFactor = basis ? 0.76 : 1;
    const globalCount = 3_214_000_000;
    const latestBase = Math.round(6_500_000 * countryFactor * basisFactor);

    const thisYear = new Date().getUTCFullYear();
    const yearlyData = Array.from({ length: 10 }, (_, i) => {
      const year = thisYear - 9 + i;
      const trend = 0.62 + i * 0.06;
      return { year, count: Math.round(latestBase * trend) };
    });

    const speciesSeed = [
      "Passer montanus",
      "Corvus corone",
      "Homo sapiens",
      "Cyanistes caeruleus",
      "Turdus merula",
      "Pica pica",
      "Parus major",
      "Apis mellifera"
    ];

    const speciesData = speciesSeed.map((label, idx) => ({
      label,
      count: Math.round((latestBase * (0.24 - idx * 0.02)) / 10)
    }));

    return {
      globalCount,
      filteredCount: yearlyData.reduce((sum, d) => sum + d.count, 0),
      yearlyData,
      speciesData
    };
  }

  async fetchYearly(country, basis) {
    const thisYear = new Date().getUTCFullYear();
    const years = Array.from({ length: 10 }, (_, i) => thisYear - 9 + i);
    const counts = await Promise.all(
      years.map(async (year) => {
        const params = new URLSearchParams({ country, year: `${year}`, limit: "0" });
        if (basis) params.set("basisOfRecord", basis);
        const res = await fetch(`https://api.gbif.org/v1/occurrence/search?${params.toString()}`);
        if (!res.ok) throw new Error(`year ${year} fetch failed`);
        const json = await res.json();
        return { year, count: json.count };
      })
    );
    return counts;
  }

  async fetchTopSpecies(country, basis) {
    const params = new URLSearchParams({
      country,
      facet: "speciesKey",
      facetLimit: "8",
      limit: "0"
    });
    if (basis) params.set("basisOfRecord", basis);

    const res = await fetch(`https://api.gbif.org/v1/occurrence/search?${params.toString()}`);
    if (!res.ok) throw new Error("species fetch failed");
    const json = await res.json();
    const counts = json.facets?.[0]?.counts ?? [];

    return Promise.all(
      counts.map(async (entry) => {
        const speciesRes = await fetch(`https://api.gbif.org/v1/species/${entry.name}`);
        const speciesJson = speciesRes.ok ? await speciesRes.json() : {};
        return {
          label: speciesJson.scientificName || `Species ${entry.name}`,
          count: entry.count
        };
      })
    );
  }

  renderAll(data) {
    this.renderMetrics(data.globalCount, data.filteredCount, data.yearlyData);
    this.renderChart(data.yearlyData);
    this.renderSpecies(data.speciesData);
  }

  renderMetrics(globalCount, filteredCount, yearlyData) {
    const first = yearlyData[0]?.count || 0;
    const last = yearlyData[yearlyData.length - 1]?.count || 0;
    const growth = first ? ((last - first) / first) * 100 : 0;

    this.querySelector("#m-global").textContent = `${numberFmt.format(globalCount)} 件`;
    this.querySelector("#m-filtered").textContent = `${numberFmt.format(filteredCount)} 件`;
    this.querySelector("#m-growth").textContent = `${growth >= 0 ? "+" : ""}${growth.toFixed(1)}%`;
    this.querySelector("#m-latest").textContent = `${numberFmt.format(last)} 件`;
  }

  renderChart(yearlyData) {
    const ctx = this.ctx;
    const w = this.chart.width;
    const h = this.chart.height;
    ctx.clearRect(0, 0, w, h);

    const pad = { top: 20, right: 16, bottom: 36, left: 64 };
    const chartW = w - pad.left - pad.right;
    const chartH = h - pad.top - pad.bottom;
    const max = Math.max(...yearlyData.map((d) => d.count), 1);

    ctx.strokeStyle = "#2d4468";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + (chartH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(w - pad.right, y);
      ctx.stroke();
    }

    ctx.strokeStyle = "#22d3ee";
    ctx.fillStyle = "#22d3ee";
    ctx.lineWidth = 2.5;

    yearlyData.forEach((d, i) => {
      const x = pad.left + (chartW * i) / (yearlyData.length - 1);
      const y = pad.top + chartH - (d.count / max) * chartH;

      if (i === 0) {
        ctx.beginPath();
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    ctx.font = "12px Inter, sans-serif";
    ctx.fillStyle = "#93a4bf";
    yearlyData.forEach((d, i) => {
      const x = pad.left + (chartW * i) / (yearlyData.length - 1);
      ctx.beginPath();
      ctx.arc(x, pad.top + chartH - (d.count / max) * chartH, 3, 0, Math.PI * 2);
      ctx.fill();
      if (i % 2 === 0 || i === yearlyData.length - 1) {
        ctx.fillText(String(d.year), x - 14, h - 12);
      }
    });

    ctx.fillStyle = "#cfe5ff";
    ctx.fillText(numberFmt.format(max), 8, pad.top + 2);
    ctx.fillText("0", 36, pad.top + chartH + 4);
  }

  renderSpecies(speciesData) {
    const tbody = this.querySelector("#species-body");
    tbody.innerHTML = speciesData
      .map((s) => `<tr><td>${s.label}</td><td>${numberFmt.format(s.count)}</td></tr>`)
      .join("");
  }

  setStatus(message, isError) {
    this.statusEl.textContent = message;
    this.statusEl.classList.toggle("error", Boolean(isError));
  }
}

customElements.define("gbif-megadata-pulse", GbifMegaDataPulse);

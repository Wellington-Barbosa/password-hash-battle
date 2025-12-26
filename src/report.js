// src/report.js
// Gera um report HTML5 (com animações + Chart.js via CDN) a partir do results/benchmark.json
// e, opcionalmente, roda o benchmark antes.

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// --- Helpers Utilitários ---

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function toFixed2(n) {
  return Number(n).toFixed(2);
}

// Formata data para: dd/mm/aaaa hh:mm
function formatDateBR(isoString) {
  if (!isoString) return "--/--/---- --:--";
  const date = new Date(isoString);
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date);
}

// --- Função Principal ---

function main() {
  const projectRoot = process.cwd();
  const resultsDir = path.join(projectRoot, "results");
  ensureDir(resultsDir);

  // 1) Rodar benchmark (profile=all), se pedir
  // Por padrão roda sim, mas dá pra desligar: npm run report -- --no-bench
  const args = process.argv.slice(2);
  const noBench = args.includes("--no-bench");

  if (!noBench) {
    console.log("▶ Running benchmark (all profiles)...");
    try {
      execSync("node src/benchmark.js --profile=all --runs=6 --json=true", {
        stdio: "inherit",
      });
    } catch (e) {
      console.error("⚠️ Erro ao rodar benchmark. Verifique se o script existe.");
      process.exit(1);
    }
  }

  // 2) Ler benchmark.json
  const benchmarkFile = path.join(resultsDir, "benchmark.json");
  if (!fs.existsSync(benchmarkFile)) {
    console.error("❌ Missing results/benchmark.json. Run: npm run bench -- --profile=all");
    process.exit(1);
  }

  const data = readJson(benchmarkFile);

  // Estrutura esperada do benchmark.json:
  // data.results = [{ profile, bcrypt, argon2id }]
  const rows = (data.results || []).map((r) => {
    const profile = r.profile;
    const b = r.bcrypt;
    const a = r.argon2id;

    return {
      profile,
      bcryptAvg: b.stats.avgMs,
      bcryptP95: b.stats.p95Ms,
      argonAvg: a.stats.avgMs,
      argonP95: a.stats.p95Ms,
      bcryptParams: b.params,
      argonParams: a.params,
    };
  });

  // Preparar arrays pro Chart.js
  const labels = rows.map((r) => r.profile);
  const bcryptAvg = rows.map((r) => r.bcryptAvg);
  const argonAvg = rows.map((r) => r.argonAvg);
  const bcryptP95 = rows.map((r) => r.bcryptP95);
  const argonP95 = rows.map((r) => r.argonP95);

  // 3) Gerar HTML

  // Dados de Cabeçalho
  const rawDate = data.meta?.createdAt || new Date().toISOString();
  const createdAtFormatted = formatDateBR(rawDate);

  const nodeVersion = escapeHtml(data.meta?.node || process.version);
  const platformInfo = escapeHtml(`${data.meta?.platform || process.platform} / ${data.meta?.arch || process.arch}`);

  // Gerar linhas da tabela
  const tableRowsHtml = rows
    .map((r) => {
      const bParams = escapeHtml(JSON.stringify(r.bcryptParams, null, 2)); // Pretty print no JSON
      const aParams = escapeHtml(JSON.stringify(r.argonParams, null, 2));
      return `
        <tr>
          <td><span class="badge">${escapeHtml(r.profile)}</span></td>
          <td class="num">${toFixed2(r.bcryptAvg)} ms</td>
          <td class="num">${toFixed2(r.bcryptP95)} ms</td>
          <td class="num">${toFixed2(r.argonAvg)} ms</td>
          <td class="num">${toFixed2(r.argonP95)} ms</td>
          <td class="muted small">
            <details>
              <summary>ver params</summary>
              <pre>${bParams}</pre>
            </details>
          </td>
          <td class="muted small">
            <details>
              <summary>ver params</summary>
              <pre>${aParams}</pre>
            </details>
          </td>
        </tr>
      `;
    })
    .join("");

  // Template HTML
  const html = `<!doctype html>
<html lang="pt-br">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Password Hash Battle — Report</title>

  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>

  <style>
    :root {
      --bg: #0b1020;
      --card: #121a33;
      --text: #eaf0ff;
      --muted: #a8b3d6;
      --accent: #7c5cff;       /* Argon2id color */
      --accent2: #00d4ff;      /* Bcrypt color */
      --border: rgba(255, 255, 255, 0.08);
      --shadow: 0 14px 40px rgba(0, 0, 0, 0.35);
      --table-hover: rgba(255, 255, 255, 0.04);
    }
    
    * { box-sizing: border-box; }
    
    body {
      margin: 0;
      font-family: ui-sans-serif, system-ui, -apple-system, Roboto, Arial, sans-serif;
      background: var(--bg);
      background-image: 
        radial-gradient(circle at 15% 15%, rgba(124,92,255,0.15) 0%, transparent 40%),
        radial-gradient(circle at 85% 35%, rgba(0,212,255,0.12) 0%, transparent 40%);
      color: var(--text);
      line-height: 1.6;
    }

    /* Typography & Header */
    header {
      padding: 40px 20px 20px;
      max-width: 1200px;
      margin: 0 auto;
      text-align: center;
    }
    
    .title {
      font-size: clamp(24px, 5vw, 36px);
      margin: 0 0 10px 0;
      letter-spacing: -0.5px;
    }
    
    .subtitle {
      margin: 0 auto 20px;
      color: var(--muted);
      max-width: 600px;
      font-size: 15px;
    }

    .meta-bar {
      display: inline-flex;
      flex-wrap: wrap;
      gap: 12px;
      justify-content: center;
      font-size: 13px;
      color: var(--muted);
    }
    
    .pill {
      background: rgba(255,255,255,0.05);
      border: 1px solid var(--border);
      padding: 4px 12px;
      border-radius: 99px;
    }
    .pill b { color: var(--text); }

    /* Layout */
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      display: grid;
      gap: 24px;
    }

    .grid-2 {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 24px;
    }
    
    .grid-kpi {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
    }

    /* Components */
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 24px;
      box-shadow: var(--shadow);
      position: relative;
    }

    h2 {
      margin: 0 0 16px 0;
      font-size: 18px;
      font-weight: 600;
      color: var(--text);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .note {
      margin-top: 16px;
      padding: 12px 16px;
      background: rgba(0,0,0,0.2);
      border-left: 3px solid var(--accent);
      border-radius: 4px;
      font-size: 13px;
      color: var(--muted);
    }
    .note b { color: var(--text); }

    /* KPIs */
    .kpi-box {
      background: rgba(255,255,255,0.03);
      padding: 16px;
      border-radius: 12px;
      border: 1px solid var(--border);
      text-align: center;
    }
    .kpi-label { font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: var(--muted); }
    .kpi-value { font-size: 24px; font-weight: 700; margin: 8px 0 4px; color: var(--text); }
    .kpi-hint { font-size: 11px; color: var(--muted); opacity: 0.8; }

    /* Charts */
    .chart-container {
      position: relative;
      height: 300px;
      width: 100%;
    }

    /* Table */
    .table-wrapper {
      overflow-x: auto;
      border-radius: 12px;
      border: 1px solid var(--border);
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
      white-space: nowrap; /* Evita quebra de linha indesejada em mobile */
    }
    
    thead { background: rgba(0,0,0,0.3); }
    
    th {
      text-align: left;
      padding: 14px 16px;
      color: var(--muted);
      font-weight: 600;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    td {
      padding: 12px 16px;
      border-bottom: 1px solid var(--border);
      background: rgba(255,255,255,0.01);
    }
    
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: var(--table-hover); }

    .badge {
      display: inline-block;
      padding: 4px 8px;
      background: rgba(124, 92, 255, 0.15);
      color: #9d85ff;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
    }

    .num { font-family: 'Consolas', 'Monaco', monospace; letter-spacing: -0.5px; }
    
    details summary { cursor: pointer; color: var(--accent2); outline: none; font-size: 12px; }
    pre {
      margin: 8px 0 0;
      padding: 8px;
      background: #080c15;
      border-radius: 6px;
      font-size: 11px;
      overflow-x: auto;
      color: #ccc;
    }

    /* Footer */
    footer {
      text-align: center;
      padding: 40px;
      color: var(--muted);
      font-size: 12px;
    }
  </style>
</head>

<body>
  <header>
    <h1 class="title">Password Hash Battle: <span style="color:var(--accent2)">bcrypt</span> vs <span style="color:var(--accent)">Argon2id</span></h1>
    <p class="subtitle">Análise comparativa de performance, latência e custo computacional.</p>

    <div class="meta-bar">
      <span class="pill">Data: <b>${createdAtFormatted}</b></span>
      <span class="pill">Node: <b>${nodeVersion}</b></span>
      <span class="pill">System: <b>${platformInfo}</b></span>
    </div>
  </header>

  <main class="container">
    
    <section class="card">
      <h2>📊 Resumo Executivo (Profile de Referência)</h2>
      <div class="grid-kpi" id="kpis">
        </div>
      <div class="note">
        <b>Interpretação:</b> O <b>Argon2id</b> é projetado para ser <i>memory-hard</i>, então custos maiores de memória/tempo são esperados dependendo da configuração. O <b>bcrypt</b> depende puramente de CPU.
      </div>
    </section>

    <section class="grid-2">
      <div class="card">
        <h2>⏱️ Tempo Médio (Avg)</h2>
        <div class="chart-container">
          <canvas id="avgChart"></canvas>
        </div>
      </div>
      
      <div class="card">
        <h2>⚠️ Latência P95 (Pior Caso)</h2>
        <div class="chart-container">
          <canvas id="p95Chart"></canvas>
        </div>
      </div>
    </section>

    <section class="card">
      <h2>📝 Dados Detalhados & Parâmetros</h2>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Profile</th>
              <th>bcrypt (avg)</th>
              <th>bcrypt (p95)</th>
              <th>Argon2 (avg)</th>
              <th>Argon2 (p95)</th>
              <th>bcrypt Params</th>
              <th>Argon2 Params</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
          </tbody>
        </table>
      </div>
    </section>

  </main>

  <footer>
    Gerado automaticamente via Node.js Report Script
  </footer>

  <script>
    // Dados injetados pelo Node
    const labels = ${JSON.stringify(labels)};
    const bcryptAvg = ${JSON.stringify(bcryptAvg)};
    const argonAvg = ${JSON.stringify(argonAvg)};
    const bcryptP95 = ${JSON.stringify(bcryptP95)};
    const argonP95 = ${JSON.stringify(argonP95)};

    function formatMs(v){ return Number(v).toFixed(2) + " ms"; }

    // --- 1. Popular KPIs ---
    // Tenta pegar o profile 'balanced' como base, ou o primeiro disponível
    const idxBalanced = labels.indexOf("balanced");
    const idx = idxBalanced >= 0 ? idxBalanced : 0;
    const refProfile = labels[idx];

    const kpisEl = document.getElementById("kpis");
    
    // Cálculo de diferença simples
    const diff = argonAvg[idx] - bcryptAvg[idx];
    const diffLabel = diff > 0 ? \`+\${formatMs(diff)} (mais lento)\` : \`\${formatMs(diff)} (mais rápido)\`;
    const diffColor = diff > 0 ? '#ff4d6d' : '#37d67a'; // Vermelho se argon for mais lento, verde se for mais rápido (contexto relativo)

    const kpiData = [
      { label: "Profile Base", value: refProfile, hint: "Configuração de referência" },
      { label: "Bcrypt (Avg)", value: formatMs(bcryptAvg[idx]), hint: "Média de execução" },
      { label: "Argon2id (Avg)", value: formatMs(argonAvg[idx]), hint: "Média de execução" },
      { label: "Diferença (Argon vs Bcrypt)", value: diffLabel, hint: "Comparativo direto", color: diffColor }
    ];

    kpisEl.innerHTML = kpiData.map(k => \`
      <div class="kpi-box">
        <div class="kpi-label">\${k.label}</div>
        <div class="kpi-value" style="\${k.color ? 'color:'+k.color : ''}">\${k.value}</div>
        <div class="kpi-hint">\${k.hint}</div>
      </div>
    \`).join("");


    // --- 2. Configurações Globais dos Gráficos ---
    Chart.defaults.color = "#a8b3d6";
    Chart.defaults.font.family = "ui-sans-serif, system-ui, sans-serif";
    
    const commonOptions = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: { labels: { color: "#eaf0ff", usePointStyle: true, boxWidth: 8 } },
        tooltip: {
          backgroundColor: 'rgba(18, 26, 51, 0.9)',
          titleColor: '#fff',
          bodyColor: '#ccc',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          padding: 10,
          callbacks: { label: (ctx) => " " + ctx.dataset.label + ": " + formatMs(ctx.raw) }
        }
      },
      scales: {
        x: { grid: { color: "rgba(255,255,255,0.04)" }, ticks: { color: "#a8b3d6" } },
        y: { grid: { color: "rgba(255,255,255,0.04)" }, ticks: { color: "#a8b3d6" }, beginAtZero: true }
      }
    };

    // --- 3. Renderizar Gráficos ---
    
    // Avg Chart
    new Chart(document.getElementById("avgChart"), {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "bcrypt",
            data: bcryptAvg,
            backgroundColor: "rgba(0, 212, 255, 0.6)",
            borderColor: "rgba(0, 212, 255, 1)",
            borderWidth: 1,
            borderRadius: 4
          },
          {
            label: "argon2id",
            data: argonAvg,
            backgroundColor: "rgba(124, 92, 255, 0.6)",
            borderColor: "rgba(124, 92, 255, 1)",
            borderWidth: 1,
            borderRadius: 4
          }
        ]
      },
      options: commonOptions
    });

    // P95 Chart
    new Chart(document.getElementById("p95Chart"), {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "bcrypt (p95)",
            data: bcryptP95,
            tension: 0.4,
            borderColor: "rgba(0, 212, 255, 1)",
            backgroundColor: "rgba(0, 212, 255, 0.1)",
            fill: true,
            pointRadius: 4,
            pointHoverRadius: 6
          },
          {
            label: "argon2id (p95)",
            data: argonP95,
            tension: 0.4,
            borderColor: "rgba(124, 92, 255, 1)",
            backgroundColor: "rgba(124, 92, 255, 0.1)",
            fill: true,
            pointRadius: 4,
            pointHoverRadius: 6
          }
        ]
      },
      options: commonOptions
    });
  </script>
</body>
</html>`;

  const outFile = path.join(resultsDir, "report.html");
  fs.writeFileSync(outFile, html, "utf-8");

  console.log(`\n✅ Relatório gerado com sucesso: ${outFile}`);
  console.log("💡 Abra o HTML no navegador.");
}

main();
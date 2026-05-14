/* ===== TABS ===== */
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.sim-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
  });
});

/* ===== INFO TOGGLES ===== */
function setupInfoToggle(btnId, panelId) {
  const btn = document.getElementById(btnId);
  const panel = document.getElementById(panelId);
  btn.addEventListener('click', () => {
    panel.classList.toggle('hidden');
    btn.textContent = panel.classList.contains('hidden') ? '💡 Why does this matter?' : '💡 Hide explanation';
  });
}
setupInfoToggle('pipette-info-btn', 'pipette-info');
setupInfoToggle('gel-info-btn', 'gel-info');
setupInfoToggle('cent-info-btn', 'cent-info');

/* ============================================================
   MICROPIPETTE SIMULATION
============================================================ */
const pipetteState = {
  volume: 10,
  hasLiquid: false,
  step: 'choose', // 'choose' | 'aspirate' | 'dispense' | 'done'
};

// Volume buttons
document.querySelectorAll('.vol-btn').forEach(btn => {
  if (btn.closest('#tab-pipette')) {
    btn.addEventListener('click', () => {
      if (pipetteState.step !== 'choose') return;
      document.querySelectorAll('#tab-pipette .vol-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      pipetteState.volume = parseInt(btn.dataset.vol);
      document.getElementById('pipette-vol-display').textContent = `${pipetteState.volume} µL`;
      setStatus('pipette-status', `Volume set to ${pipetteState.volume} µL. Click the source tube to aspirate.`);
      pipetteState.step = 'aspirate';
    });
  }
});

// Source tube - aspirate
document.getElementById('source-tube').addEventListener('click', () => {
  if (pipetteState.step !== 'aspirate') return;
  pipetteState.hasLiquid = true;
  pipetteState.step = 'dispense';

  const pipette = document.getElementById('pipette');
  pipette.classList.add('aspirating');
  setTimeout(() => pipette.classList.remove('aspirating'), 400);

  document.getElementById('pipette-liquid').style.height = '75%';
  setStatus('pipette-status', `✅ Aspirated ${pipetteState.volume} µL. Now click the target tube to dispense.`);
});

// Target tube - dispense
document.getElementById('target-tube').addEventListener('click', () => {
  if (pipetteState.step !== 'dispense') return;
  pipetteState.hasLiquid = false;
  pipetteState.step = 'done';

  const pipette = document.getElementById('pipette');
  pipette.classList.add('dispensing');
  setTimeout(() => pipette.classList.remove('dispensing'), 400);

  document.getElementById('pipette-liquid').style.height = '0%';

  // Calculate fill amount in target based on volume
  const maxVol = 1000;
  const fillPct = Math.min((pipetteState.volume / maxVol) * 80 + 10, 80);
  document.getElementById('target-liquid').style.height = fillPct + '%';

  // Random accuracy 95-100%
  const acc = (95 + Math.random() * 5).toFixed(1);
  document.getElementById('accuracy-display').textContent = `✅ Dispensed! Accuracy: ${acc}%`;
  setStatus('pipette-status', `🧪 Transfer complete. ${pipetteState.volume} µL moved to target. Hit Reset to try again.`);
});

document.getElementById('pipette-reset').addEventListener('click', () => {
  pipetteState.step = 'choose';
  pipetteState.hasLiquid = false;
  pipetteState.volume = 10;
  document.getElementById('pipette-liquid').style.height = '0%';
  document.getElementById('target-liquid').style.height = '0%';
  document.getElementById('accuracy-display').textContent = '';
  document.getElementById('pipette-vol-display').textContent = '10 µL';
  document.querySelectorAll('#tab-pipette .vol-btn').forEach((b, i) => {
    b.classList.toggle('active', i === 0);
  });
  setStatus('pipette-status', 'Choose a volume and click the source tube.');
});

/* ============================================================
   GEL ELECTROPHORESIS SIMULATION
============================================================ */
const gelState = {
  lanes: { 0: null, 1: null, 2: null, 3: null },
  running: false,
  bands: [], // { el, speed, position, max }
  animId: null,
};

const voltSlider = document.getElementById('volt-slider');
const voltLabel = document.getElementById('volt-label');
voltSlider.addEventListener('input', () => { voltLabel.textContent = voltSlider.value; });

document.querySelectorAll('.sample-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (gelState.running) return;
    const lane = parseInt(btn.dataset.lane);
    if (gelState.lanes[lane]) return; // already loaded
    gelState.lanes[lane] = btn.dataset.sizes.split(',').map(Number);
    btn.classList.add('loaded');
    document.querySelector(`.well[data-lane="${lane}"]`).classList.add('loaded');
    setStatus(null, null);
  });
});

document.getElementById('gel-run').addEventListener('click', () => {
  if (gelState.running) return;
  const hasAny = Object.values(gelState.lanes).some(v => v !== null);
  if (!hasAny) { alert('Load at least one sample first!'); return; }

  gelState.running = true;
  document.getElementById('gel-run').disabled = true;

  const voltage = parseInt(voltSlider.value);
  const speedMult = voltage / 80; // normalized

  // Create bands
  gelState.bands = [];
  Object.entries(gelState.lanes).forEach(([lane, sizes]) => {
    if (!sizes) return;
    const laneEl = document.querySelector(`.gel-lane[data-lane="${lane}"]`);
    sizes.forEach(size => {
      const band = document.createElement('div');
      band.className = 'gel-band';
      band.style.top = '0px';
      laneEl.appendChild(band);
      // Smaller = faster
      const speed = (1000 / size) * speedMult * 0.4;
      gelState.bands.push({ el: band, speed, position: 0, max: 190 });
    });
  });

  animateBands();
});

function animateBands() {
  let allDone = true;
  gelState.bands.forEach(b => {
    if (b.position < b.max) {
      b.position = Math.min(b.position + b.speed, b.max);
      b.el.style.top = b.position + 'px';
      allDone = false;
    }
  });
  if (!allDone) {
    gelState.animId = requestAnimationFrame(animateBands);
  } else {
    gelState.running = false;
  }
}

document.getElementById('gel-reset').addEventListener('click', () => {
  if (gelState.animId) cancelAnimationFrame(gelState.animId);
  gelState.running = false;
  gelState.bands = [];
  Object.keys(gelState.lanes).forEach(k => gelState.lanes[k] = null);

  document.querySelectorAll('.gel-lane').forEach(l => l.innerHTML = '');
  document.querySelectorAll('.well').forEach(w => w.classList.remove('loaded'));
  document.querySelectorAll('.sample-btn').forEach(b => b.classList.remove('loaded'));
  document.getElementById('gel-run').disabled = false;
  voltSlider.value = 80;
  voltLabel.textContent = 80;
});

/* ============================================================
   CENTRIFUGE SIMULATION
============================================================ */
const centState = {
  rpm: 3000,
  sample: 'blood',
  running: false,
  animId: null,
  currentRpm: 0,
};

const SAMPLES = {
  blood: [
    { label: 'RBCs', pct: 40, color: '#c0392b' },
    { label: 'Buffy', pct: 5, color: '#f5f5dc' },
    { label: 'Plasma', pct: 55, color: '#f1c40f55' },
  ],
  cells: [
    { label: 'Pellet', pct: 20, color: '#3498db' },
    { label: 'Media', pct: 80, color: 'rgba(100,200,255,0.3)' },
  ],
  dna: [
    { label: 'DNA', pct: 15, color: '#2ecc71' },
    { label: 'Ethanol', pct: 35, color: 'rgba(180,220,255,0.3)' },
    { label: 'Buffer', pct: 50, color: 'rgba(100,180,255,0.2)' },
  ],
};

const rpmSlider = document.getElementById('rpm-slider');
const rpmLabel = document.getElementById('rpm-label');
rpmSlider.addEventListener('input', () => {
  centState.rpm = parseInt(rpmSlider.value);
  rpmLabel.textContent = centState.rpm.toLocaleString();
});

document.querySelectorAll('#tab-centrifuge .vol-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (centState.running) return;
    document.querySelectorAll('#tab-centrifuge .vol-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    centState.sample = btn.dataset.sample;
    resetCentResult();
  });
});

document.getElementById('centrifuge-run').addEventListener('click', () => {
  if (centState.running) return;
  centState.running = true;
  document.getElementById('centrifuge-run').disabled = true;
  resetCentResult();

  const rotor = document.getElementById('centrifuge-rotor');
  const display = document.getElementById('rpm-display');
  const targetRpm = centState.rpm;
  let currentRpm = 0;

  // Spin up
  const spinUpInterval = setInterval(() => {
    currentRpm = Math.min(currentRpm + targetRpm / 30, targetRpm);
    const duration = (60 / currentRpm).toFixed(2);
    rotor.style.animationDuration = duration + 's';
    rotor.classList.add('spinning');
    display.textContent = Math.round(currentRpm).toLocaleString() + ' RPM';

    if (currentRpm >= targetRpm) {
      clearInterval(spinUpInterval);
      setTimeout(() => spinDown(), 2500);
    }
  }, 80);

  function spinDown() {
    const spinDownInterval = setInterval(() => {
      currentRpm = Math.max(currentRpm - targetRpm / 20, 0);
      if (currentRpm > 0) {
        const duration = (60 / currentRpm).toFixed(2);
        rotor.style.animationDuration = duration + 's';
      }
      display.textContent = Math.round(currentRpm).toLocaleString() + ' RPM';

      if (currentRpm <= 0) {
        clearInterval(spinDownInterval);
        rotor.classList.remove('spinning');
        display.textContent = '0 RPM';
        centState.running = false;
        document.getElementById('centrifuge-run').disabled = false;
        showCentResult();
      }
    }, 60);
  }
});

function resetCentResult() {
  const afterLayers = document.getElementById('after-layers');
  afterLayers.innerHTML = '';
}

function showCentResult() {
  const layers = SAMPLES[centState.sample];
  const afterLayers = document.getElementById('after-layers');
  afterLayers.innerHTML = '';
  layers.forEach(layer => {
    const div = document.createElement('div');
    div.className = 'layer';
    div.style.height = layer.pct + '%';
    div.style.background = layer.color;
    div.textContent = layer.label;
    afterLayers.appendChild(div);
  });
}

document.getElementById('centrifuge-reset').addEventListener('click', () => {
  centState.running = false;
  centState.currentRpm = 0;
  document.getElementById('centrifuge-rotor').classList.remove('spinning');
  document.getElementById('rpm-display').textContent = '0 RPM';
  document.getElementById('centrifuge-run').disabled = false;
  resetCentResult();
  rpmSlider.value = 3000;
  rpmLabel.textContent = '3,000';
  centState.rpm = 3000;
  document.querySelectorAll('#tab-centrifuge .vol-btn').forEach((b, i) => {
    b.classList.toggle('active', i === 0);
  });
  centState.sample = 'blood';
});

/* ===== UTILITY ===== */
function setStatus(id, text) {
  if (!id) return;
  const el = document.getElementById(id);
  if (el && text) el.textContent = text;
}
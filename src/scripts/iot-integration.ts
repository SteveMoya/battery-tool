/**
 * F11 — IoT Integration & Monitoring Engine
 * Generates monitoring configurations for MQTT, Modbus, CAN
 */

import { t } from '../i18n';

export interface IoTConfig {
  protocol: 'mqtt' | 'modbus' | 'can';
  sampleRateSeconds: number;
  dataPoints: IoTDataPoint[];
  alarmConfig: AlarmConfig;
}

export interface IoTDataPoint {
  name: string;
  unit: string;
  minValue: number;
  maxValue: number;
  alarmThresholdHigh: number;
  alarmThresholdLow: number;
  category: 'voltage' | 'current' | 'temperature' | 'soc' | 'soh' | 'balance' | 'status';
}

export interface AlarmConfig {
  overvoltagePerCell: number; // V
  undervoltagePerCell: number; // V
  overcurrent: number; // A
  overtemperature: number; // °C
  undertemperature: number; // °C
  lowSoC: number; // %
  highSoC: number; // %
}

export interface IoTResult {
  protocol: string;
  totalDataPoints: number;
  samplingRateMs: number;
  estimatedBandwidth: string;
  configJson: string;
  datapointsCsv: string;
  homeAssistantConfig: string;
  grafanaConfig: string;
  recommendations: string[];
  level: 'good' | 'warning';
  levelColor: string;
}

function generateDataPoints(packVoltage: number, maxCurrent: number, seriesCells: number, tempSensors: number): IoTDataPoint[] {
  const vPerCell = packVoltage / seriesCells;

  return [
    // Voltage
    { name: 'pack_voltage', unit: 'V', minValue: 0, maxValue: packVoltage * 1.2, alarmThresholdHigh: packVoltage * 1.05, alarmThresholdLow: packVoltage * 0.85, category: 'voltage' },
    { name: 'cell_voltage_min', unit: 'V', minValue: 2.5, maxValue: 4.5, alarmThresholdHigh: 4.2, alarmThresholdLow: 2.8, category: 'voltage' },
    { name: 'cell_voltage_max', unit: 'V', minValue: 2.5, maxValue: 4.5, alarmThresholdHigh: 4.2, alarmThresholdLow: 2.8, category: 'voltage' },
    { name: 'cell_voltage_avg', unit: 'V', minValue: 2.5, maxValue: 4.5, alarmThresholdHigh: 4.1, alarmThresholdLow: 3.0, category: 'voltage' },

    // Current
    { name: 'pack_current', unit: 'A', minValue: -maxCurrent * 1.2, maxValue: maxCurrent * 1.2, alarmThresholdHigh: maxCurrent, alarmThresholdLow: -maxCurrent * 0.8, category: 'current' },
    { name: 'current_avg', unit: 'A', minValue: -maxCurrent, maxValue: maxCurrent, alarmThresholdHigh: maxCurrent * 0.9, alarmThresholdLow: -maxCurrent * 0.7, category: 'current' },

    // Temperature (per sensor group)
    { name: 'temp_min', unit: '°C', minValue: -40, maxValue: 80, alarmThresholdHigh: 55, alarmThresholdLow: -20, category: 'temperature' },
    { name: 'temp_max', unit: '°C', minValue: -40, maxValue: 80, alarmThresholdHigh: 60, alarmThresholdLow: -15, category: 'temperature' },
    { name: 'temp_avg', unit: '°C', minValue: -40, maxValue: 80, alarmThresholdHigh: 50, alarmThresholdLow: -10, category: 'temperature' },
    { name: 'temp_delta', unit: '°C', minValue: 0, maxValue: 30, alarmThresholdHigh: 10, alarmThresholdLow: 0, category: 'temperature' },

    // SoC / SoH
    { name: 'soc', unit: '%', minValue: 0, maxValue: 100, alarmThresholdHigh: 95, alarmThresholdLow: 10, category: 'soc' },
    { name: 'soh', unit: '%', minValue: 0, maxValue: 100, alarmThresholdHigh: 100, alarmThresholdLow: 70, category: 'soh' },

    // Balance
    { name: 'cell_imbalance', unit: 'mV', minValue: 0, maxValue: 500, alarmThresholdHigh: 100, alarmThresholdLow: 0, category: 'balance' },
    { name: 'balance_status', unit: '', minValue: 0, maxValue: 1, alarmThresholdHigh: 1, alarmThresholdLow: 0, category: 'balance' },

    // Status
    { name: 'pack_status', unit: '', minValue: 0, maxValue: 5, alarmThresholdHigh: 4, alarmThresholdLow: 0, category: 'status' },
    { name: 'error_code', unit: '', minValue: 0, maxValue: 255, alarmThresholdHigh: 128, alarmThresholdLow: 0, category: 'status' },
  ];
}

function generateMqttConfig(dataPoints: IoTDataPoint[], sampleRateMs: number): string {
  const config = {
    mqtt: {
      broker: 'mqtt://localhost:1883',
      topic_prefix: 'battery/pack',
      qos: 1,
      retain: true,
      sample_rate_ms: sampleRateMs,
    },
    topics: dataPoints.map(dp => ({
      topic: `battery/pack/${dp.name}`,
      unit: dp.unit,
      payload: `{ "value": ${dp.name}, "timestamp": "\${timestamp}" }`,
    })),
  };
  return JSON.stringify(config, null, 2);
}

function generateModbusConfig(dataPoints: IoTDataPoint[]): string {
  const config = {
    modbus: {
      mode: 'RTU',
      baudrate: 9600,
      parity: 'none',
      stopbits: 1,
      slave_id: 1,
    },
    registers: dataPoints.map((dp, i) => ({
      name: dp.name,
      address: 100 + i * 2,
      type: 'holding_register',
      unit: dp.unit,
      scale: 1,
      readonly: true,
    })),
  };
  return JSON.stringify(config, null, 2);
}

function generateCanConfig(dataPoints: IoTDataPoint[]): string {
  const config = {
    can: {
      interface: 'can0',
      bitrate: 500000,
      sample_rate_ms: 100,
    },
    messages: dataPoints.map((dp, i) => ({
      name: dp.name,
      arbitration_id: 0x100 + i,
      dlc: 8,
      byte_order: 'little_endian',
      signals: [{
        name: dp.name,
        start_bit: 0,
        length: 16,
        scale: 0.1,
        offset: 0,
        unit: dp.unit,
      }],
    })),
  };
  return JSON.stringify(config, null, 2);
}

function generateGrafanaConfig(dataPoints: IoTDataPoint[]): string {
  return JSON.stringify({
    dashboard: {
      title: t('iot.batteryPackMonitoring'),
      panels: dataPoints.filter(dp => dp.category !== 'status').map((dp, i) => ({
        id: i + 1,
        title: dp.name,
        type: 'graph',
        targets: [{ topic: `battery/pack/${dp.name}` }],
        thresholds: [
          { value: dp.alarmThresholdHigh, color: 'red' },
          { value: dp.alarmThresholdLow, color: 'yellow' },
        ],
      })),
    },
  }, null, 2);
}

function generateHomeAssistantConfig(dataPoints: IoTDataPoint[]): string {
  const ha = {
    mqtt: {
      sensor: dataPoints.map(dp => ({
        name: dp.name,
        state_topic: `battery/pack/${dp.name}`,
        unit_of_measurement: dp.unit,
        value_template: '{{ value_json.value }}',
        icon: dp.category === 'voltage' ? 'mdi:flash'
          : dp.category === 'current' ? 'mdi:current-ac'
          : dp.category === 'temperature' ? 'mdi:thermometer'
          : dp.category === 'soc' ? 'mdi:battery'
          : 'mdi:information',
      })),
    },
  };
  return JSON.stringify(ha, null, 2);
}

function generateCsv(dataPoints: IoTDataPoint[]): string {
  const header = 'name,unit,min,max,alarm_high,alarm_low,category';
  const rows = dataPoints.map(dp =>
    `${dp.name},${dp.unit},${dp.minValue},${dp.maxValue},${dp.alarmThresholdHigh},${dp.alarmThresholdLow},${dp.category}`
  );
  return [header, ...rows].join('\n');
}

export function analyzeIoT(
  protocol: 'mqtt' | 'modbus' | 'can',
  sampleRateSeconds: number,
  packVoltage: number,
  maxCurrent: number,
  seriesCells: number,
  tempSensors: number,
): IoTResult {
  const dataPoints = generateDataPoints(packVoltage, maxCurrent, seriesCells, tempSensors);
  const samplingRateMs = sampleRateSeconds * 1000;
  const totalDataPoints = dataPoints.length;

  // Rough bandwidth estimate: ~50 bytes per datapoint per sample
  const bytesPerSample = totalDataPoints * 50;
  const samplesPerHour = 3600 / sampleRateSeconds;
  const bandwidthPerHourKb = (bytesPerSample * samplesPerHour) / 1024;

  let estimatedBandwidth: string;
  if (bandwidthPerHourKb < 100) {
    estimatedBandwidth = `${bandwidthPerHourKb.toFixed(1)} KB/hr`;
  } else if (bandwidthPerHourKb < 1024) {
    estimatedBandwidth = `${(bandwidthPerHourKb / 1024).toFixed(1)} MB/hr`;
  } else {
    estimatedBandwidth = `${(bandwidthPerHourKb / 1024 / 1024).toFixed(2)} GB/hr`;
  }

  // Generate config based on selected protocol
  let configJson: string;
  switch (protocol) {
    case 'modbus':
      configJson = generateModbusConfig(dataPoints);
      break;
    case 'can':
      configJson = generateCanConfig(dataPoints);
      break;
    case 'mqtt':
    default:
      configJson = generateMqttConfig(dataPoints, samplingRateMs);
      break;
  }
  const datapointsCsv = generateCsv(dataPoints);
  const homeAssistantConfig = generateHomeAssistantConfig(dataPoints);
  const grafanaConfig = generateGrafanaConfig(dataPoints);

  const recommendations: string[] = [];
  if (sampleRateSeconds < 1) {
    recommendations.push(t('iot.highSampleRate'));
  }
  if (seriesCells > 16) {
    recommendations.push(t('iot.canBusRecommendation'));
  }
  if (protocol === 'modbus' && sampleRateSeconds < 5) {
    recommendations.push(t('iot.modbusBottleneck'));
  }
  if (tempSensors > 8) {
    recommendations.push(t('iot.manyTempSensors'));
  }

  return {
    protocol,
    totalDataPoints,
    samplingRateMs,
    estimatedBandwidth,
    configJson,
    datapointsCsv,
    homeAssistantConfig,
    grafanaConfig,
    recommendations,
    level: recommendations.length === 0 ? 'good' : 'warning',
    levelColor: recommendations.length === 0 ? '#22c55e' : '#f59e0b',
  };
}

export function renderIoTCard(result: IoTResult): string {
  return `
    <div class="rounded-md p-2.5 mb-2" style="background: var(--bg-tertiary); border: 1px solid var(--border-primary);">
      <div class="flex justify-between items-start mb-2">
        <div>
          <div class="text-[0.65rem] font-bold" style="color: var(--text-primary);">
            ${result.protocol.toUpperCase()} — ${result.totalDataPoints} ${t('iot.dataPoints')}
          </div>
          <div class="text-[0.6rem] mt-0.5" style="color: var(--text-muted);">
            ${t('iot.sample')} ${result.samplingRateMs}ms | ${t('iot.bw')} ${result.estimatedBandwidth}
          </div>
        </div>
        <div class="text-[0.58rem] font-bold px-1.5 py-0.5 rounded" style="background: ${result.levelColor}20; color: ${result.levelColor};">
          ${result.level.toUpperCase()}
        </div>
      </div>

      <div class="space-y-1 mb-2">
        <div class="flex items-center gap-2">
          <button class="iot-export-btn text-[0.58rem] px-1.5 py-0.5 rounded font-bold" style="background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-primary);" data-format="mqtt">
            ${t('iot.mqttConfig')}
          </button>
          <button class="iot-export-btn text-[0.58rem] px-1.5 py-0.5 rounded font-bold" style="background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-primary);" data-format="grafana">
            ${t('iot.grafana')}
          </button>
          <button class="iot-export-btn text-[0.58rem] px-1.5 py-0.5 rounded font-bold" style="background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-primary);" data-format="ha">
            ${t('iot.homeAssistant')}
          </button>
          <button class="iot-export-btn text-[0.58rem] px-1.5 py-0.5 rounded font-bold" style="background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-primary);" data-format="csv">
            ${t('iot.csv')}
          </button>
        </div>
      </div>

      ${result.recommendations.length > 0 ? `
        <div class="space-y-0.5">
          ${result.recommendations.map(r => `
            <div class="text-[0.56rem]" style="color: var(--text-muted);">• ${r}</div>
          `).join('')}
        </div>
      ` : `
        <div class="text-[0.56rem]" style="color: var(--text-muted);">${t('iot.noSpecialRequirements')}</div>
      `}
    </div>
  `;
}

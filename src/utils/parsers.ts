import { EDFHeader, SignalHeader, ParsedEDF, AnalysisResult,CSVMetadata } from '../types';

const parseString = (buffer: ArrayBuffer, start: number, length: number): string => {
  const decoder = new TextDecoder('ascii');
  return decoder.decode(buffer.slice(start, start + length)).trim();
};

const parseNumber = (buffer: ArrayBuffer, start: number, length: number): number => {
  const str = parseString(buffer, start, length);
  return parseFloat(str);
};

export const parseEDF = async (file: File): Promise<ParsedEDF> => {
  const buffer = await file.arrayBuffer();
  const header: EDFHeader = {
    version: parseString(buffer, 0, 8),
    patientId: parseString(buffer, 8, 80),
    recordId: parseString(buffer, 88, 80),
    startDate: parseString(buffer, 168, 8),
    startTime: parseString(buffer, 176, 8),
    headerBytes: parseNumber(buffer, 184, 8),
    reserved: parseString(buffer, 192, 44),
    numDataRecords: parseNumber(buffer, 236, 8),
    recordDuration: parseNumber(buffer, 244, 8),
    numSignals: parseNumber(buffer, 252, 4),
  };

  const ns = header.numSignals;
  const signals: SignalHeader[] = [];
  let curr = 256;

  const readSignalProps = (length: number) => {
    const props = [];
    for (let i = 0; i < ns; i++) {
      props.push(parseString(buffer, curr + (i * length), length));
    }
    curr += ns * length;
    return props;
  };

  const readSignalNums = (length: number) => {
    const props = [];
    for (let i = 0; i < ns; i++) {
      props.push(parseFloat(parseString(buffer, curr + (i * length), length)));
    }
    curr += ns * length;
    return props;
  };

  const labels = readSignalProps(16);
  const transducers = readSignalProps(80);
  const dimensions = readSignalProps(8);
  const physMins = readSignalNums(8);
  const physMaxs = readSignalNums(8);
  const digMins = readSignalNums(8);
  const digMaxs = readSignalNums(8);
  const prefilterings = readSignalProps(80);
  const samplesPerRecords = readSignalNums(8);
  curr += ns * 32;

  for (let i = 0; i < ns; i++) {
    signals.push({
      label: labels[i],
      transducerType: transducers[i],
      physicalDimension: dimensions[i],
      physicalMin: physMins[i],
      physicalMax: physMaxs[i],
      digitalMin: digMins[i],
      digitalMax: digMaxs[i],
      prefiltering: prefilterings[i],
      samplesPerRecord: samplesPerRecords[i],
    });
  }

  const dataStart = header.headerBytes;
  const dataView = new DataView(buffer);
  const channelData: Float32Array[] = signals.map(sig => 
    new Float32Array(header.numDataRecords * sig.samplesPerRecord)
  );

  let bufferOffset = dataStart;
  const scales = signals.map(s => (s.physicalMax - s.physicalMin) / (s.digitalMax - s.digitalMin));
  const polyB = signals.map((s, i) => s.physicalMin - (s.digitalMin * scales[i]));

  for (let r = 0; r < header.numDataRecords; r++) {
    for (let s = 0; s < ns; s++) {
      const sig = signals[s];
      const sampleCount = sig.samplesPerRecord;
      const targetArray = channelData[s];
      const startIdx = r * sampleCount;
      const scale = scales[s];
      const bias = polyB[s];

      for (let k = 0; k < sampleCount; k++) {
        const raw = dataView.getInt16(bufferOffset, true);
        targetArray[startIdx + k] = (raw * scale) + bias;
        bufferOffset += 2;
      }
    }
  }

  return { header, signals, data: channelData, totalDuration: header.numDataRecords * header.recordDuration };
};

export const parseCSV = (csvContent: string): { results: AnalysisResult[], metadata: CSVMetadata } => {
  const lines = csvContent.trim().split('\n');
  const results: AnalysisResult[] = [];
  
  let metadata: CSVMetadata = { gender: '', age: '', fileStart: '' };

  /**
   * Converts HH:MM:SS or HH:MM:SS:mmm to total seconds.
   * Handles variable lengths (some rows have milliseconds, some don't).
   */
  const timeToSeconds = (timeStr: string): number => {
    if (!timeStr) return 0;
    const parts = timeStr.trim().split(':');
    
    const hours = parseInt(parts[0]) || 0;
    const minutes = parseInt(parts[1]) || 0;
    const seconds = parseInt(parts[2]) || 0;
    const millis = parts.length > 3 ? parseInt(parts[3]) : 0;
    
    // In your CSV, the 4th part is milliseconds (e.g., 426)
    return (hours * 3600) + (minutes * 60) + seconds + (millis / 1000);
  };

  let fileStartSec = 0;

  // 1. Extract Metadata and Global File Start Time
  if (lines.length > 1) {
    const firstDataLine = lines[1].split(',').map(f => f.trim().replace(/^"|"$/g, ''));
    
    metadata = {
      gender: firstDataLine[0] || 'Unknown',
      age: firstDataLine[1] || 'Unknown',
      fileStart: firstDataLine[2] || '00:00:00'
    };
    
    fileStartSec = timeToSeconds(metadata.fileStart);
  }

  // 2. Parse Rows into Events
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    // Use a regex to split by comma but ignore commas inside quotes if necessary
    const fields = line.split(',').map(f => f.trim().replace(/^"|"$/g, ''));
    
    // According to your CSV structure:
    // [0]Gender, [1]Age, [2]FileStart, [3]StartTime, [4]EndTime, [5]ChannelNames, [6]Comment
    const startTimeStr = fields[3];
    const endTimeStr = fields[4];
    const channelNamesStr = fields[5];
    const comment = fields[6];

    if (!startTimeStr || !endTimeStr || !channelNamesStr) continue;

    const startSec = timeToSeconds(startTimeStr) - fileStartSec;
    const endSec = timeToSeconds(endTimeStr) - fileStartSec;

    // FIX: Split the space-separated channels (e.g., "FP1 FP2 F3" -> ["FP1", "FP2", "F3"])
    const channelList = channelNamesStr.split(/\s+/).filter(name => name.length > 0);

    // Create a unique event entry for every channel mentioned in the row
    channelList.forEach((channelName, index) => {
      results.push({
        window_id: `csv_evt_${i}_${index}`, 
        classification: 'abnormal',
        channel_name: channelName, // Individual channel name
        global_start_time_sec: startSec,
        global_end_time_sec: endSec,
        label: comment || 'Detected',
        event: [{ 
          confidence: 1.0, 
          region_start_time_sec: startSec, 
          region_end_time_sec: endSec 
        }]
      });
    });
  }

  // Sort by time so the sidebar list is chronological
  return { 
    results: results.sort((a, b) => a.global_start_time_sec - b.global_start_time_sec), 
    metadata 
  };
};

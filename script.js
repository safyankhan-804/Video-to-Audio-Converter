const videoToAudio = async (file) => {
  try {
    console.log("videoToAudio file", file);
    const fileData = new Blob([file]); // video file

    const arrayBuffer = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const arrayBuffer = reader.result;
        resolve(arrayBuffer);
      };
      reader.readAsArrayBuffer(fileData);
    });
    console.log("arrayBuffer", arrayBuffer);

    const audioContext = new (window.AudioContext ||
      window.webkitAudioContext ||
      window.mozAudioContext ||
      window.msAudioContext)();
    const decodedAudioData = await audioContext.decodeAudioData(arrayBuffer);
    console.log("decodedAudioData", decodedAudioData);
    const fileDuration = durationTrans(decodedAudioData.duration);
    console.log("fileDuration", fileDuration);

    const offlineAudioContext = new OfflineAudioContext(
      decodedAudioData.numberOfChannels,
      decodedAudioData.sampleRate * decodedAudioData.duration,
      decodedAudioData.sampleRate
    );
    const soundSource = offlineAudioContext.createBufferSource();
    soundSource.buffer = decodedAudioData;
    soundSource.connect(offlineAudioContext.destination);
    soundSource.start();

    const renderedBuffer = await offlineAudioContext.startRendering();
    console.log("renderedBuffer", renderedBuffer); // outputs audiobuffer
    const wav = audioBufferToWav(renderedBuffer);

    const fileType = "wav";
    const fileName = `converted-audio.${fileType}`;
    const audioBlob = new Blob([new DataView(wav)], { type: "audio/wav" });

    return { fileName, blob: audioBlob };
  } catch (error) {
    console.log("videoToAudio error", error);
    return null;
  } finally {
    console.log("videoToAudio finally");
  }
};

const audioBufferToWav = (buffer, opt) => {
  opt = opt || {};

  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = opt.float32 ? 3 : 1;
  const bitDepth = format === 3 ? 32 : 16;

  let result;
  if (numChannels === 2) {
    result = interleave(buffer.getChannelData(0), buffer.getChannelData(1));
  } else {
    result = buffer.getChannelData(0);
  }

  return encodeWAV(result, format, sampleRate, numChannels, bitDepth);
};

const encodeWAV = (samples, format, sampleRate, numChannels, bitDepth) => {
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;

  const buffer = new ArrayBuffer(44 + samples.length * bytesPerSample);
  const view = new DataView(buffer);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + samples.length * bytesPerSample, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, "data");
  view.setUint32(40, samples.length * bytesPerSample, true);
  if (format === 1) {
    floatTo16BitPCM(view, 44, samples);
  } else {
    writeFloat32(view, 44, samples);
  }
  return buffer;
};

const interleave = (inputL, inputR) => {
  const length = inputL.length + inputR.length;
  const result = new Float32Array(length);
  let index = 0;
  let inputIndex = 0;
  while (index < length) {
    result[index++] = inputL[inputIndex];
    result[index++] = inputR[inputIndex];
    inputIndex++;
  }
  return result;
};

const writeFloat32 = (output, offset, input) => {
  for (let i = 0; i < input.length; i++, offset += 4) {
    output.setFloat32(offset, input[i], true);
  }
};

const floatTo16BitPCM = (output, offset, input) => {
  for (let i = 0; i < input.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
};

const writeString = (view, offset, string) => {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
};

const durationTrans = (a) => {
  let b = "";
  let h = parseInt(a / 3600),
    m = parseInt((a % 3600) / 60),
    s = parseInt((a % 3600) % 60);
  if (h > 0) {
    h = h < 10 ? "0" + h : h;
    b += h + ":";
  }
  m = m < 10 ? "0" + m : m;
  s = s < 10 ? "0" + s : s;
  b += m + ":" + s;
  return b;
};

const videoInput = document.getElementById("videoInput");
const convertBtn = document.getElementById("convertBtn");
const progressContainer = document.getElementById("progressContainer");
const progressBar = document.getElementById("progressBar");
const downloadLink = document.getElementById("downloadLink");
const refreshBtn = document.getElementById("refreshBtn");
const fileCount = document.getElementById("fileCount");

videoInput.addEventListener("change", (event) => {
  const files = event.target.files;
  if (files.length > 0) {
    fileCount.textContent = `${files.length} file(s) selected`;
    fileCount.style.display = "block";
  } else {
    fileCount.textContent = "No file selected";
    fileCount.style.display = "none";
  }
});

convertBtn.addEventListener("click", async () => {
  const files = videoInput.files;
  if (files.length === 0) {
    alert("Please select a video file first.");
    return;
  }

  progressContainer.style.display = "block";
  progressBar.style.width = "0%";

  const file = files[0];
  const { fileName, blob } = await videoToAudio(file);

  if (blob) {
    const url = URL.createObjectURL(blob);
    downloadLink.href = url;
    downloadLink.download = fileName;
    downloadLink.style.display = "block";
    downloadLink.textContent = `Download ${fileName}`;
  }

  progressBar.style.width = "100%";
  setTimeout(() => {
    progressContainer.style.display = "none";
    refreshBtn.style.display = "block";
  }, 1000);
});

refreshBtn.addEventListener("click", () => {
  videoInput.value = "";
  fileCount.style.display = "none";
  downloadLink.style.display = "none";
  progressContainer.style.display = "none";
  refreshBtn.style.display = "none";
});

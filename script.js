// Car Camera System Application

// Global variables
var peer;
var conn;
var isCarMode = true;
var isCarModeId = 0;
var isConnected = false;
var carId = '';

// Camera streams
let frontCameraStream;
let backCameraStream;

// Available devices
let videoDevices = [];

// Ping/Latency measurement
let lastPingTime = 0;
let currentLatency = 0;
let pingInterval;

// Motion detection
let motionDetectionIntervals = {};
let previousFrameData = {};

// DOM Elements - Mode Selection
const carModeBtn = document.getElementById('car-mode-btn');
const carModeBtn2 = document.getElementById('car2-mode-btn');
const clientModeBtn = document.getElementById('client-mode-btn');
const carInterface = document.getElementById('car-interface');
const carInterface2 = document.getElementById('car-interface2');
const clientInterface = document.getElementById('client-interface');

// DOM Elements - Car Mode
const carIdElement = document.getElementById('car-id');
const copyCarIdButton = document.getElementById('copy-car-id');
const generateNewIdButton = document.getElementById('generate-new-id');
const carConnectionStatus = document.getElementById('car-connection-status');
const carConnectionLatency = document.getElementById('car-connection-latency');

const frontCamera = document.getElementById('front-camera');
const backCamera = document.getElementById('back-camera');

const frontCameraSelect = document.getElementById('front-camera-select');
const backCameraSelect = document.getElementById('back-camera-select');
const applyCameraSettingsButton = document.getElementById(
  'apply-camera-settings'
);

const frontMotionOverlay = document.getElementById('front-motion-overlay');
const sideMotionOverlay = document.getElementById('side-motion-overlay');
const backMotionOverlay = document.getElementById('back-motion-overlay');

// DOM Elements - Client Mode
const carIdInput = document.getElementById('car-id-input');
const carIdInput2 = document.getElementById('car-id-input2');
const connectButton = document.getElementById('connect-btn');
const carbutton = document.getElementById('car-connect-btn');
const clientConnectionStatus = document.getElementById(
  'client-connection-status'
);
const clientConnectionLatency = document.getElementById(
  'client-connection-latency'
);

const fullscreenBtn = document.getElementById('fullscreen-btn');
const frontViewBtn = document.getElementById('front-view-btn');
const sideViewBtn = document.getElementById('side-view-btn');
const backViewBtn = document.getElementById('back-view-btn');
const allViewBtn = document.getElementById('all-view-btn');

const clientFrontView = document.getElementById('client-front-view');
const clientSideView = document.getElementById('client-side-view');
const clientBackView = document.getElementById('client-back-view');

const clientFrontViewSmall = document.getElementById('client-front-view-small');
const clientSideViewSmall = document.getElementById('client-side-view-small');
const clientBackViewSmall = document.getElementById('client-back-view-small');

const immersiveView = document.getElementById('immersive-view');
const allCamerasView = document.getElementById('all-cameras-view');
const clientMotionOverlay = document.getElementById('client-motion-overlay');

// Initialize the application
function initialize() {
  // Set up mode selection
  carModeBtn.addEventListener('click', () => switchMode(true,0));
  carModeBtn2.addEventListener('click', () => switchMode(true,1));
  clientModeBtn.addEventListener('click', () => switchMode(false));

  // Initialize based on default mode (car mode)
  if (isCarMode) {
    initializeCarMode();
  }
}

// Switch between car and client modes
function switchMode(toCarMode,id=2) {
  isCarMode = toCarMode;
  isCarModeId = id
  // Update UI
  if (isCarMode && id == 0) {
    carModeBtn.classList.add('active');
    carModeBtn2.classList.remove('active');
    clientModeBtn.classList.remove('active');
    carInterface.classList.remove('hidden');
    carInterface2.classList.add('hidden');
    clientInterface.classList.add('hidden');

    // Initialize car mode if not already initialized
    initializeCarMode();
  } else if (isCarMode && id == 1) {
    carModeBtn2.classList.add('active');
    carModeBtn.classList.remove('active');
    clientModeBtn.classList.remove('active');
    carInterface2.classList.remove('hidden');
    carInterface.classList.add('hidden');
    clientInterface.classList.add('hidden');

    // Initialize car mode if not already initialized
    initializeCarMode();
  } else {
    carModeBtn.classList.remove('active');
    carModeBtn2.classList.remove('active');
    clientModeBtn.classList.add('active');
    carInterface.classList.add('hidden');
    clientInterface.classList.remove('hidden');

    // Initialize client mode
    initializeClientMode();
  }

  // Close existing connection when switching modes
  if (conn) {
    conn.close();
  }

  // Reset connection status
  isConnected = false;
  updateConnectionStatus();
}

// Generate a random ID for the car
function generateCarId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Initialize PeerJS for car mode
function initializeCarMode() {
  // Get available cameras
  getAvailableCameras();

  // Generate a new car ID if we don't have one
  if (!carId) {
    carId = generateCarId();
  }
  carbutton.addEventListener('click', () => {
    const id = carIdInput2.value.trim();
    if (id) {
      connectToCarAsCam(id);

    // Initialize PeerJS with the car ID
    initializePeer('carcal2-' + carIdInput2);

    // Display the car ID (without prefix)
    carIdElement.textContent = carId;

    // Set up event listeners for car mode
    copyCarIdButton.addEventListener('click', () => {
      navigator.clipboard
        .writeText(carId)
        .then(() => {
          alert('Car ID copied to clipboard');
        })
        .catch((err) => {
          console.error('Failed to copy:', err);
        });
    });

    generateNewIdButton.addEventListener('click', () => {
      // Generate a new ID
      carId = generateCarId();
      carIdElement.textContent = carId;

      // Reinitialize peer with new ID
      initializePeer('carcal-' + carId);
    });

    applyCameraSettingsButton.addEventListener('click', () => {
    applyCameraSettings();
  });
    } else {
      alert('Please enter a Car ID');
    }
  });
}

// Initialize PeerJS for client mode
function initializeClientMode() {
  // Initialize PeerJS with a random ID
  initializePeer();

  // Set up event listeners for client mode
  connectButton.addEventListener('click', () => {
    const id = carIdInput.value.trim();
    if (id) {
      connectToCar(id);
    } else {
      alert('Please enter a Car ID');
    }
  });

  // Fullscreen button
  fullscreenBtn.addEventListener('click', toggleFullscreen);
}

// Initialize PeerJS
function initializePeer(specificId = null) {
  // Destroy existing peer if any
  if (peer) {
    peer.destroy();
  }

  // If specific ID is provided, use it
  if (specificId) {
    peer = new Peer(specificId, {
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' }, // Google's public STUN server
        ],
      },
    });
  } else {
    peer = new Peer({
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' }, // Google's public STUN server
        ],
      },
    });
  }

  // Create a new Peer

  // When peer is open (connected to the signaling server)
  peer.on('open', (id) => {
    console.log('My peer ID is: ' + id);

    // If in car mode, update the car ID
    if (isCarMode && !specificId) {
      // Extract the ID without prefix
      const rawId = id.startsWith('carcal-') ? id.substring(7) : id;
      carId = rawId;
      carIdElement.textContent = carId;
    }
  });

  // Handle incoming data connection
  peer.on('connection', (dataConnection) => {
    if (isCarMode) {
      handleCarConnection(dataConnection);
    }
  }); // Handle incoming call (video)

  // Handle incoming call (video)
  peer.on('call', async (call) => {
    console.log(call, isCarMode, call.metadata);

    if (isCarMode && isCarModeId == 0) {
      try {
        // In car mode, answer with the appropriate camera stream based on metadata
        const metadata = call.metadata || {};
        const cameraType = metadata.cameraType || 'front';

        let stream;
        switch (cameraType) {
          case 'front':
            stream = await navigator.mediaDevices.getUserMedia({
              video: { deviceId: { exact: frontCameraSelect.value } },
              audio: false,
            });
            console.log('Front camera stream obtained');
            break;
          case 'back':
            stream = await navigator.mediaDevices.getUserMedia({
              video: { deviceId: { exact: backCameraSelect.value } },
              audio: false,
            });
            console.log('Back camera stream obtained');
            break;
        }

        if (stream) {
          setTimeout(() => {
            call.answer(stream);
            console.log(`Answered with ${cameraType} camera stream`, stream);
          }, 1000);

          call.on('stream', (remoteStream) => {
            console.log('Got remote stream:', remoteStream);
          });
        } else {
          console.error(
            `Cannot answer call for ${cameraType} camera - stream not available`
          );
        }
      } catch (err) {
        console.error('Failed to initialize camera streams:', err);
        alert('Failed to access cameras: ' + err.message);
        return;
      }
    } else if (isCarMode && isCarModeId == 1) {
      try {
        // In car mode, answer with the appropriate camera stream based on metadata
        const metadata = call.metadata || {};
        const cameraType = metadata.cameraType || 'front';

        let stream;
        switch (cameraType) {
          case 'front':
            stream = await navigator.mediaDevices.getUserMedia({
              video: { deviceId: { exact: frontCameraSelect.value } },
              audio: false,
            });
            console.log('Front camera stream obtained');
            break;
          case 'back':
            stream = await navigator.mediaDevices.getUserMedia({
              video: { deviceId: { exact: backCameraSelect.value } },
              audio: false,
            });
            console.log('Back camera stream obtained');
            break;
        }

        if (stream) {
          setTimeout(() => {
            call.answer(stream);
            console.log(`Answered with ${cameraType} camera stream`, stream);
          }, 1000);

          call.on('stream', (remoteStream) => {
            console.log('Got remote stream:', remoteStream);
          });
        } else {
          console.error(
            `Cannot answer call for ${cameraType} camera - stream not available`
          );
        }
      } catch (err) {
        console.error('Failed to initialize camera streams:', err);
        alert('Failed to access cameras: ' + err.message);
        return;
      }
    }
  });

  // Handle errors
  peer.on('error', (err) => {
    console.error('PeerJS error:', err);

    const statusElement = isCarMode
      ? carConnectionStatus
      : clientConnectionStatus;
    statusElement.textContent = 'Error: ' + err.type;

    // If the ID is already taken, generate a new one in car mode
    if (err.type === 'unavailable-id' && isCarMode) {
      carId = generateCarId();
      carIdElement.textContent = carId;
      initializePeer('carcal-' + carId);
    }
  });
}

// Get available cameras
async function getAvailableCameras() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    videoDevices = devices.filter((device) => device.kind === 'videoinput');

    // Populate camera select elements
    populateCameraSelects();

    // Initialize default camera streams
    await initializeCameraStreams();
  } catch (err) {
    console.error('Failed to get available cameras:', err);
    alert('Failed to access cameras: ' + err.message);
  }
}

// Populate camera select elements
function populateCameraSelects() {
  // Clear existing options
  frontCameraSelect.innerHTML = '<option value="">None</option>';
  backCameraSelect.innerHTML = '<option value="">None</option>';

  // Add camera options to each select
  videoDevices.forEach((device, index) => {
    const frontOption = document.createElement('option');
    frontOption.value = device.deviceId;
    frontOption.text = device.label || `Camera ${index + 1}`;
    frontCameraSelect.appendChild(frontOption);

    const backOption = document.createElement('option');
    backOption.value = device.deviceId;
    backOption.text = device.label || `Camera ${index + 1}`;
    backCameraSelect.appendChild(backOption);
  });

  // If we have multiple cameras, set different defaults for each view
  if (videoDevices.length > 1) {
    frontCameraSelect.selectedIndex = 0;
    backCameraSelect.selectedIndex = 0;
  }
}

// Initialize camera streams with default devices
async function initializeCameraStreams() {
  try {
    // Get front camera stream
    frontCameraStream = await navigator.mediaDevices.getUserMedia({
      video: {
        deviceId: frontCameraSelect.value
          ? { exact: frontCameraSelect.value }
          : undefined,
      },
    });
    frontCamera.srcObject = frontCameraStream;

    // If we have multiple cameras, try to get separate streams
    if (videoDevices.length > 1) {
      // Get back camera stream if we have a third camera
      if (videoDevices.length > 2) {
        backCameraStream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: backCameraSelect.value
              ? { exact: backCameraSelect.value }
              : undefined,
          },
        });
        backCamera.srcObject = backCameraStream;
      } else {
        backCamera.srcObject = backCameraStream;
      }
    } else {
      // If we only have one camera, use it for all views
      backCameraStream = frontCameraStream;
      backCamera.srcObject = backCameraStream;
    }
  } catch (err) {
    console.error('Failed to initialize camera streams:', err);
    alert('Failed to access cameras: ' + err.message);
  }
}

// Apply selected camera settings
async function applyCameraSettings() {
  // Stop current streams
  if (frontCameraStream) {
    frontCameraStream.getTracks().forEach((track) => track.stop());
  }
  if (
    backCameraStream &&
    backCameraStream !== frontCameraStream
  ) {
    backCameraStream.getTracks().forEach((track) => track.stop());
  }

  // Clear motion detection intervals
  Object.values(motionDetectionIntervals).forEach((interval) =>
    clearInterval(interval)
  );
  motionDetectionIntervals = {};

  try {
    if (frontCameraSelect.value != '') {
      // Get front camera stream
      frontCameraStream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: frontCameraSelect.value
            ? { exact: frontCameraSelect.value }
            : undefined,
        },
      });
      frontCamera.srcObject = frontCameraStream;
    }

    if (backCameraSelect.value != '') {
      // Get back camera stream
      backCameraStream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: backCameraSelect.value
            ? { exact: backCameraSelect.value }
            : undefined,
        },
      });
      backCamera.srcObject = backCameraStream;
    }

    // If connected to a client, update the streams
    if (isConnected && conn) {
      // Notify client that camera streams have changed
      conn.send({
        type: 'camera-streams-updated',
      });
    }
  } catch (err) {
    console.error('Failed to apply camera settings:', err);
    alert('Failed to apply camera settings: ' + err.message);
  }
}

// Handle connection as a car
function handleCarConnection(dataConnection) {
  // Close existing connection if any
  if (conn) {
    conn.close();
  }

  conn = dataConnection;

  conn.on('open', () => {
    isConnected = true;
    updateConnectionStatus();
    console.log('Connected to client: ' + conn.peer);

    // Start ping for latency measurement
    startPingMeasurement();
  });

  conn.on('data', (data) => {
    handleIncomingData(data);
  });

  conn.on('close', () => {
    isConnected = false;
    updateConnectionStatus();
    console.log('Connection closed');

    // Stop ping measurement
    clearInterval(pingInterval);
  });
}

// connec to a car as the back cam for mobile device
function connectToCarAsCam(carIdValue) {
  // Add prefix if not already present
  const fullCarId = carIdValue.startsWith('carcal-')
    ? carIdValue
    : 'carcal-' + carIdValue;

  // Create data connection
  const dataConnection = peer.connect(fullCarId);

  dataConnection.on('open', () => {
    conn = dataConnection;
    isConnected = true;
    updateConnectionStatus();
    console.log('Connected to car: ' + conn.peer);

    // Start ping for latency measurement
    startPingMeasurement();
  });

  dataConnection.on('data', (data) => {
    handleIncomingData(data);
  });

  dataConnection.on('close', () => {
    conn = null;
    isConnected = false;
    updateConnectionStatus();
    console.log('Connection closed');

    // Stop ping measurement
    clearInterval(pingInterval);
  });

  dataConnection.on('error', (err) => {
    console.error('Connection error:', err);
    clientConnectionStatus.textContent = 'Error: ' + err;
  });
}

// Connect to a car as a client
function connectToCar(carIdValue) {
  // Add prefix if not already present
  const fullCarId = carIdValue.startsWith('carcal-')
    ? carIdValue
    : 'carcal-' + carIdValue;

  // Create data connection
  const dataConnection = peer.connect(fullCarId);

  dataConnection.on('open', () => {
    conn = dataConnection;
    isConnected = true;
    updateConnectionStatus();
    console.log('Connected to car: ' + conn.peer);

    // Start ping for latency measurement
    startPingMeasurement();

    // Request camera streams
    requestCameraStreams();
  });

  dataConnection.on('data', (data) => {
    handleIncomingData(data);
  });

  dataConnection.on('close', () => {
    conn = null;
    isConnected = false;
    updateConnectionStatus();
    console.log('Connection closed');

    // Stop ping measurement
    clearInterval(pingInterval);
  });

  dataConnection.on('error', (err) => {
    console.error('Connection error:', err);
    clientConnectionStatus.textContent = 'Error: ' + err;
  });
}

// Request camera streams from the car
function requestCameraStreams() {
  const createEmptyAudioTrack = () => {
    const createEmptyAudioTrack = () => {
      const ctx = new AudioContext();
      const oscillator = ctx.createOscillator();
      const dst = oscillator.connect(ctx.createMediaStreamDestination());
      oscillator.start();
      const track = dst.stream.getAudioTracks()[0];
      return Object.assign(track, { enabled: false });
    };

    const createEmptyVideoTrack = ({ width, height }) => {
      const canvas = Object.assign(document.createElement('canvas'), {
        width,
        height,
      });
      canvas.getContext('2d').fillRect(0, 0, width, height);

      const stream = canvas.captureStream();
      const track = stream.getVideoTracks()[0];

      return Object.assign(track, { enabled: false });
    };

    return new MediaStream([
      createEmptyAudioTrack(),
      createEmptyVideoTrack({ width: 640, height: 480 }),
    ]);
  };

  console.log('Requesting front camera...');

  // Initiate the call with the empty stream
  const frontCall = peer.call(conn.peer, createEmptyAudioTrack(), {
    metadata: { cameraType: 'front' },
  });

  frontCall.on('stream', (stream) => {
    console.log('Front camera stream received.', stream);
    clientFrontView.srcObject = stream;
    clientFrontViewSmall.srcObject = stream;
  });

  frontCall.on('error', (err) => {
    console.error('Front camera error:', err);
  });
  console.log('Requesting side camera...');
  const sideCall = peer.call(conn.peer, createEmptyAudioTrack(), {
    metadata: { cameraType: 'side' },
  });

  sideCall.on('stream', (stream) => {
    console.log('Side camera stream received.');
    clientSideView.srcObject = stream;
    clientSideViewSmall.srcObject = stream;
  });

  sideCall.on('error', (err) => {
    console.error('Side camera error:', err);
  });
  console.log('Requesting back camera...');
  const backCall = peer.call(conn.peer, createEmptyAudioTrack(), {
    metadata: { cameraType: 'back' },
  });
  console.log;

  backCall.on('stream', (stream) => {
    console.log('Back camera stream received.');
    clientBackView.srcObject = stream;
    clientBackViewSmall.srcObject = stream;
  });

  backCall.on('error', (err) => {
    console.error('Back camera error:', err);
  });
}

// Handle incoming data
function handleIncomingData(data) {
  // Handle ping/pong for latency measurement
  if (data.type === 'ping') {
    // Send pong back immediately
    conn.send({
      type: 'pong',
      id: data.id,
      timestamp: data.timestamp,
    });
    return;
  } else if (data.type === 'pong') {
    // Calculate latency
    const now = Date.now();
    const pingTime = now - data.timestamp;
    currentLatency = pingTime;

    const latencyElement = isCarMode
      ? carConnectionLatency
      : clientConnectionLatency;
    latencyElement.textContent = pingTime + ' ms';
    return;
  } else if (data.type === 'camera-streams-updated' && !isCarMode) {
    // If camera streams were updated on the car, request them again
    requestCameraStreams();
  }
  console.log('Received data:', data);
}

// Start ping measurement for latency
function startPingMeasurement() {
  // Clear existing interval if any
  if (pingInterval) {
    clearInterval(pingInterval);
  }

  // Send ping every 2 seconds
  pingInterval = setInterval(() => {
    if (isConnected && conn) {
      lastPingTime = Date.now();
      conn.send({
        type: 'ping',
        id: Math.random().toString(36).substring(2, 15),
        timestamp: lastPingTime,
      });
    }
  }, 2000);
}

// Update connection status display
function updateConnectionStatus() {
  const statusElement = isCarMode
    ? carConnectionStatus
    : clientConnectionStatus;
  const latencyElement = isCarMode
    ? carConnectionLatency
    : clientConnectionLatency;

  if (isConnected) {
    statusElement.textContent = isCarMode
      ? 'Connected to client'
      : 'Connected to car';
    statusElement.classList.add('connected');
  } else {
    statusElement.textContent = isCarMode
      ? 'Waiting for connection...'
      : 'Disconnected';
    statusElement.classList.remove('connected');
    latencyElement.textContent = '-- ms';
  }
}

// Toggle fullscreen mode
function toggleFullscreen() {
  const viewContainer = document.getElementById('client-view-container');

  if (!document.fullscreenElement) {
    // Enter fullscreen
    if (viewContainer.requestFullscreen) {
      viewContainer.requestFullscreen();
    } else if (viewContainer.webkitRequestFullscreen) {
      viewContainer.webkitRequestFullscreen();
    } else if (viewContainer.msRequestFullscreen) {
      viewContainer.msRequestFullscreen();
    }

    fullscreenBtn.textContent = 'Exit Fullscreen';
  } else {
    // Exit fullscreen
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen();
    }

    viewContainer.classList.remove('fullscreen-mode');
    fullscreenBtn.textContent = 'Enter Fullscreen';
  }
}
document.addEventListener('fullscreenchange', (event) => {
  const viewContainer = document.getElementById('client-view-container');
  viewContainer.classList.toggle('fullscreen-mode');
});

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', initialize);

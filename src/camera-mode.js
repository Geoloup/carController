import { PEER_CONFIG } from './config.js';

export class CameraMode {
  constructor() {
    this.peer = null;
    this.conn = null;
    this.cameraStream = null;
    this.videoDevices = [];
    this.isConnected = false;
    this.currentLatency = 0;
    this.pingInterval = null;
    this.cameraRole = 'front';
    
    this.initializeElements();
    this.setupEventListeners();
  }

  initializeElements() {
    this.viewIdInput = document.getElementById('view-id-input');
    this.connectCameraBtn = document.getElementById('connect-camera-btn');
    this.cameraConnectionStatus = document.getElementById('camera-connection-status');
    this.cameraConnectionLatency = document.getElementById('camera-connection-latency');
    this.cameraPreview = document.getElementById('camera-preview');
    this.cameraSelect = document.getElementById('camera-select');
    this.frontCameraRoleBtn = document.getElementById('front-camera-role');
    this.backCameraRoleBtn = document.getElementById('back-camera-role');
    this.applyCameraSettingsButton = document.getElementById('apply-camera-settings');
  }

  setupEventListeners() {
    this.connectCameraBtn.addEventListener('click', () => this.connectToView());
    this.applyCameraSettingsButton.addEventListener('click', () => this.applyCameraSettings());
    this.frontCameraRoleBtn.addEventListener('click', () => this.setCameraRole('front'));
    this.backCameraRoleBtn.addEventListener('click', () => this.setCameraRole('back'));
  }

  async initialize() {
    await this.getAvailableCameras();
    this.initializePeer();
  }

  initializePeer() {
    if (this.peer) {
      this.peer.destroy();
    }

    this.peer = new Peer(PEER_CONFIG);

    this.peer.on('open', (id) => {
      console.log('Camera peer ID:', id);
    });

    this.peer.on('error', (err) => {
      console.error('PeerJS error:', err);
      this.cameraConnectionStatus.textContent = 'Error: ' + err.type;
    });
  }

  async getAvailableCameras() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      this.videoDevices = devices.filter(device => device.kind === 'videoinput');
      this.populateCameraSelects();
      await this.initializeCameraStream();
    } catch (err) {
      console.error('Failed to get cameras:', err);
      alert('Failed to access cameras: ' + err.message);
    }
  }

  populateCameraSelects() {
    this.cameraSelect.innerHTML = '<option value="">None</option>';
    this.videoDevices.forEach((device, index) => {
      const option = document.createElement('option');
      option.value = device.deviceId;
      option.text = device.label || `Camera ${index + 1}`;
      this.cameraSelect.appendChild(option);
    });
    if (this.videoDevices.length > 0) {
      this.cameraSelect.selectedIndex = 1;
    }
  }

  async initializeCameraStream() {
    try {
      if (this.cameraSelect.value) {
        this.cameraStream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: this.cameraSelect.value ? { exact: this.cameraSelect.value } : undefined
          }
        });
        this.cameraPreview.srcObject = this.cameraStream;
      }
    } catch (err) {
      console.error('Failed to initialize camera:', err);
      alert('Failed to access camera: ' + err.message);
    }
  }

  connectToView() {
    const viewId = this.viewIdInput.value.trim();
    if (!viewId) {
      alert('Please enter a View ID');
      return;
    }

    const fullViewId = viewId.startsWith('viewcal-') ? viewId : 'viewcal-' + viewId;
    const dataConnection = this.peer.connect(fullViewId);

    dataConnection.on('open', () => {
      this.conn = dataConnection;
      this.isConnected = true;
      this.updateConnectionStatus();
      this.startPingMeasurement();
      this.sendCameraStream();
    });

    dataConnection.on('data', (data) => this.handleIncomingData(data));

    dataConnection.on('close', () => {
      this.conn = null;
      this.isConnected = false;
      this.updateConnectionStatus();
      clearInterval(this.pingInterval);
    });

    dataConnection.on('error', (err) => {
      console.error('Connection error:', err);
      this.cameraConnectionStatus.textContent = 'Error: ' + err;
    });
  }

  setCameraRole(role) {
    this.cameraRole = role;
    this.frontCameraRoleBtn.classList.remove('active');
    this.backCameraRoleBtn.classList.remove('active');
    
    if (role === 'front') {
      this.frontCameraRoleBtn.classList.add('active');
    } else {
      this.backCameraRoleBtn.classList.add('active');
    }
  }

  async applyCameraSettings() {
    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach(track => track.stop());
      this.cameraStream = null;
    }

    try {
      if (this.cameraSelect.value) {
        this.cameraStream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: this.cameraSelect.value ? { exact: this.cameraSelect.value } : undefined
          }
        });
        this.cameraPreview.srcObject = this.cameraStream;
        
        if (this.isConnected && this.conn) {
          this.sendCameraStream();
        }
      }
    } catch (err) {
      console.error('Failed to apply camera settings:', err);
      alert('Failed to apply camera settings: ' + err.message);
    }
  }

  sendCameraStream() {
    if (!this.isConnected || !this.conn || !this.cameraStream) {
      console.error('Cannot send camera stream: not connected or no stream');
      return;
    }
    
    console.log(`Sending ${this.cameraRole} camera stream`);
    
    const call = this.peer.call(this.conn.peer, this.cameraStream, {
      metadata: {
        cameraType: this.cameraRole,
        cameraPeerId: this.peer.id
      }
    });
    
    call.on('error', (err) => {
      console.error('Error sending camera stream:', err);
    });
  }

  handleIncomingData(data) {
    if (data.type === 'ping') {
      this.conn.send({
        type: 'pong',
        id: data.id,
        timestamp: data.timestamp
      });
    } else if (data.type === 'pong') {
      const now = Date.now();
      const pingTime = now - data.timestamp;
      this.currentLatency = pingTime;
      this.cameraConnectionLatency.textContent = pingTime + ' ms';
    }
  }

  startPingMeasurement() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    this.pingInterval = setInterval(() => {
      if (this.isConnected && this.conn) {
        const lastPingTime = Date.now();
        this.conn.send({
          type: 'ping',
          id: Math.random().toString(36).substring(2, 15),
          timestamp: lastPingTime
        });
      }
    }, 2000);
  }

  updateConnectionStatus() {
    if (this.isConnected) {
      this.cameraConnectionStatus.textContent = 'Connected to view';
      this.cameraConnectionStatus.classList.add('connected');
    } else {
      this.cameraConnectionStatus.textContent = 'Disconnected';
      this.cameraConnectionStatus.classList.remove('connected');
      this.cameraConnectionLatency.textContent = '-- ms';
    }
  }
}
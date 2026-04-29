import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Webcam from 'react-webcam';
import {
    Camera, CameraOff, ScanFace, CheckCircle2,
    AlertTriangle, Loader, RefreshCw, Zap, Shield
} from 'lucide-react';
import { recognitionAPI } from '../services/api';
import { useToast } from '../context/ToastContext';
import './RecognitionPage.css';

export default function RecognitionPage() {
    const webcamRef = useRef(null);
    const [cameraOn, setCameraOn] = useState(false);
    const [scanning, setScanning] = useState(false);
    const [result, setResult] = useState(null);
    const [autoScan, setAutoScan] = useState(false);
    const [scanCount, setScanCount] = useState(0);
    const [predictions, setPredictions] = useState([]);
    const intervalRef = useRef(null);
    const toast = useToast();

    const startCamera = () => {
        setCameraOn(true);
        setResult(null);
        setPredictions([]);
        setScanCount(0);
    };

    const stopCamera = () => {
        setCameraOn(false);
        setAutoScan(false);
        if (intervalRef.current) clearInterval(intervalRef.current);
        setResult(null);
        setPredictions([]);
        setScanCount(0);
    };

    const captureAndRecognize = useCallback(async () => {
        if (!webcamRef.current) return;

        const imageSrc = webcamRef.current.getScreenshot();
        if (!imageSrc) return;

        setScanning(true);
        try {
            const res = await recognitionAPI.recognize(imageSrc);
            const data = res.data;

            if (data.detected && data.results?.length > 0) {
                const face = data.results[0];

                if (face.name !== 'Unknown' && face.confidence > 60) {
                    setPredictions(prev => [...prev, face]);
                    setScanCount(prev => prev + 1);

                    // After 5 consistent predictions, mark attendance
                    const newPredictions = [...predictions, face];
                    if (newPredictions.length >= 5) {
                        // Check if most predictions agree
                        const nameCounts = {};
                        newPredictions.forEach(p => {
                            nameCounts[p.name] = (nameCounts[p.name] || 0) + 1;
                        });
                        const mostCommon = Object.entries(nameCounts).sort((a, b) => b[1] - a[1])[0];

                        if (mostCommon[1] >= 3) {
                            const finalFace = newPredictions.find(p => p.name === mostCommon[0]);
                            setAutoScan(false);
                            if (intervalRef.current) clearInterval(intervalRef.current);

                            // Mark attendance
                            try {
                                const markRes = await recognitionAPI.markFromRecognition(finalFace.id, finalFace.name);
                                setResult({
                                    success: true,
                                    name: finalFace.name,
                                    id: finalFace.id,
                                    confidence: finalFace.confidence,
                                    message: markRes.data.message,
                                });
                                toast.success(`Attendance marked for ${finalFace.name}!`);
                            } catch (markErr) {
                                if (markErr.response?.status === 409) {
                                    setResult({
                                        success: false,
                                        name: finalFace.name,
                                        id: finalFace.id,
                                        confidence: finalFace.confidence,
                                        message: markErr.response.data.error,
                                        alreadyMarked: true,
                                    });
                                    toast.warning(`${finalFace.name} already marked today`);
                                } else {
                                    throw markErr;
                                }
                            }
                            setPredictions([]);
                            setScanCount(0);
                        }
                    }

                    setResult({
                        scanning: true,
                        name: face.name,
                        confidence: face.confidence,
                        scansLeft: Math.max(0, 5 - newPredictions.length),
                    });
                } else {
                    setResult({ detected: true, unknown: true });
                }
            } else {
                setResult({ detected: false });
            }
        } catch (err) {
            console.error('Recognition error:', err);
        } finally {
            setScanning(false);
        }
    }, [predictions, toast]);

    // Auto-scan mode
    useEffect(() => {
        if (autoScan && cameraOn) {
            intervalRef.current = setInterval(captureAndRecognize, 1500);
        } else {
            if (intervalRef.current) clearInterval(intervalRef.current);
        }
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [autoScan, cameraOn, captureAndRecognize]);

    const resetForNext = () => {
        setResult(null);
        setPredictions([]);
        setScanCount(0);
        setAutoScan(true);
    };

    return (
        <div className="page-container">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <div className="page-header">
                    <div>
                        <h1 className="page-title">
                            <span className="gradient-text">Face Recognition</span>
                        </h1>
                        <p className="page-subtitle">
                            Position your face in front of the camera to mark attendance
                        </p>
                    </div>
                </div>

                <div className="recognition-layout">
                    {/* Webcam Section */}
                    <div className="recognition-camera-section">
                        <div className="webcam-container glass-card-static">
                            {cameraOn ? (
                                <div className="webcam-wrapper">
                                    <Webcam
                                        ref={webcamRef}
                                        audio={false}
                                        screenshotFormat="image/jpeg"
                                        screenshotQuality={0.8}
                                        videoConstraints={{
                                            width: 640,
                                            height: 480,
                                            facingMode: 'user',
                                        }}
                                        className="webcam-feed"
                                    />

                                    {/* Scan overlay */}
                                    <div className={`scan-overlay ${scanning ? 'scanning' : ''}`}>
                                        <div className="scan-corner scan-tl" />
                                        <div className="scan-corner scan-tr" />
                                        <div className="scan-corner scan-bl" />
                                        <div className="scan-corner scan-br" />
                                        {scanning && <div className="scan-line" />}
                                    </div>

                                    {/* Status indicator */}
                                    <div className="webcam-status">
                                        <div className={`status-dot ${scanning ? 'scanning' : autoScan ? 'auto' : 'ready'}`} />
                                        <span>{scanning ? 'Scanning...' : autoScan ? 'Auto-scanning' : 'Camera ready'}</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="webcam-placeholder">
                                    <motion.div
                                        animate={{ scale: [1, 1.05, 1] }}
                                        transition={{ repeat: Infinity, duration: 2 }}
                                    >
                                        <ScanFace size={80} strokeWidth={1} />
                                    </motion.div>
                                    <h3>Camera is off</h3>
                                    <p>Click &quot;Start Camera&quot; to begin face recognition</p>
                                </div>
                            )}
                        </div>

                        {/* Controls */}
                        <div className="recognition-controls">
                            {!cameraOn ? (
                                <motion.button
                                    className="btn btn-primary btn-lg"
                                    onClick={startCamera}
                                    whileHover={{ scale: 1.03 }}
                                    whileTap={{ scale: 0.97 }}
                                >
                                    <Camera size={20} />
                                    Start Camera
                                </motion.button>
                            ) : (
                                <>
                                    <motion.button
                                        className="btn btn-danger"
                                        onClick={stopCamera}
                                        whileHover={{ scale: 1.03 }}
                                        whileTap={{ scale: 0.97 }}
                                    >
                                        <CameraOff size={18} />
                                        Stop Camera
                                    </motion.button>

                                    <motion.button
                                        className="btn btn-primary"
                                        onClick={captureAndRecognize}
                                        disabled={scanning}
                                        whileHover={{ scale: 1.03 }}
                                        whileTap={{ scale: 0.97 }}
                                    >
                                        {scanning ? <Loader size={18} className="spinning" /> : <ScanFace size={18} />}
                                        {scanning ? 'Scanning...' : 'Scan Once'}
                                    </motion.button>

                                    <motion.button
                                        className={`btn ${autoScan ? 'btn-success' : 'btn-secondary'}`}
                                        onClick={() => {
                                            setAutoScan(!autoScan);
                                            setPredictions([]);
                                            setScanCount(0);
                                            setResult(null);
                                        }}
                                        whileHover={{ scale: 1.03 }}
                                        whileTap={{ scale: 0.97 }}
                                    >
                                        <Zap size={18} />
                                        {autoScan ? 'Auto ON' : 'Auto Scan'}
                                    </motion.button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Result Section */}
                    <div className="recognition-result-section">
                        <AnimatePresence mode="wait">
                            {result?.success && (
                                <motion.div
                                    key="success"
                                    className="result-card result-success glass-card-static"
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                >
                                    <div className="result-icon-wrapper success">
                                        <CheckCircle2 size={48} />
                                    </div>
                                    <h2 className="result-name">{result.name}</h2>
                                    <p className="result-id">ID: {result.id}</p>
                                    <div className="result-confidence">
                                        <div className="confidence-bar">
                                            <motion.div
                                                className="confidence-fill"
                                                initial={{ width: 0 }}
                                                animate={{ width: `${result.confidence}%` }}
                                                transition={{ duration: 0.8 }}
                                            />
                                        </div>
                                        <span>{result.confidence}% confidence</span>
                                    </div>
                                    <p className="result-message">{result.message}</p>
                                    <motion.button
                                        className="btn btn-primary"
                                        onClick={resetForNext}
                                        style={{ marginTop: 20 }}
                                        whileHover={{ scale: 1.03 }}
                                    >
                                        <RefreshCw size={16} />
                                        Scan Next Student
                                    </motion.button>
                                </motion.div>
                            )}

                            {result?.alreadyMarked && (
                                <motion.div
                                    key="already"
                                    className="result-card result-warning glass-card-static"
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                >
                                    <div className="result-icon-wrapper warning">
                                        <AlertTriangle size={48} />
                                    </div>
                                    <h2 className="result-name">{result.name}</h2>
                                    <p className="result-message">{result.message}</p>
                                    <motion.button
                                        className="btn btn-primary"
                                        onClick={resetForNext}
                                        style={{ marginTop: 20 }}
                                        whileHover={{ scale: 1.03 }}
                                    >
                                        <RefreshCw size={16} />
                                        Scan Next Student
                                    </motion.button>
                                </motion.div>
                            )}

                            {result?.scanning && (
                                <motion.div
                                    key="scanning"
                                    className="result-card result-scanning glass-card-static"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                >
                                    <Loader size={32} className="spinning" style={{ color: 'var(--primary)' }} />
                                    <h3>Detecting: {result.name}</h3>
                                    <p>Confidence: {result.confidence}%</p>
                                    <p className="scans-left">{result.scansLeft} more scans to confirm</p>
                                    <div className="scan-progress">
                                        {[...Array(5)].map((_, i) => (
                                            <div
                                                key={i}
                                                className={`scan-dot ${i < (5 - result.scansLeft) ? 'filled' : ''}`}
                                            />
                                        ))}
                                    </div>
                                </motion.div>
                            )}

                            {result && !result.success && !result.alreadyMarked && !result.scanning && (
                                <motion.div
                                    key="noface"
                                    className="result-card result-empty glass-card-static"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                >
                                    <ScanFace size={48} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
                                    <h3>{result.unknown ? 'Unknown Face' : 'No Face Detected'}</h3>
                                    <p>{result.unknown ? 'This face is not registered in the system' : 'Please position your face in front of the camera'}</p>
                                </motion.div>
                            )}

                            {!result && cameraOn && (
                                <motion.div
                                    key="ready"
                                    className="result-card result-empty glass-card-static"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                >
                                    <Shield size={48} style={{ color: 'var(--primary)', opacity: 0.5 }} />
                                    <h3>Ready to Scan</h3>
                                    <p>Click &quot;Scan Once&quot; or enable &quot;Auto Scan&quot; to start recognition</p>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Scan History */}
                        {scanCount > 0 && (
                            <motion.div
                                className="scan-history glass-card-static"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                            >
                                <h4>Scan Progress</h4>
                                <p>{scanCount} frames analyzed</p>
                            </motion.div>
                        )}
                    </div>
                </div>
            </motion.div>
        </div>
    );
}

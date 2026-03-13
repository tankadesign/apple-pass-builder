'use client';

import { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { UploadCloud, Loader2, Wallet, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import QRCode from 'react-qr-code';

// Convert hex to rgb string for passkit-generator
const hexToRgbString = (hex: string) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${r}, ${g}, ${b})`;
};

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form State
  const [logoText, setLogoText] = useState('My Pass');
  const [description, setDescription] = useState('Apple Wallet Pass');
  const [primaryLabel, setPrimaryLabel] = useState('Item');
  const [primaryValue, setPrimaryValue] = useState('Value');
  const [backgroundColor, setBackgroundColor] = useState('#000000');
  const [foregroundColor, setForegroundColor] = useState('#ffffff');
  const [labelColor, setLabelColor] = useState('#888888');
  const [barcodeValue, setBarcodeValue] = useState('');
  const [barcodeFormat, setBarcodeFormat] = useState('PKBarcodeFormatQR');
  const [bgType, setBgType] = useState('solid');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('walletPassData');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.logoText !== undefined) setLogoText(parsed.logoText);
        if (parsed.description !== undefined) setDescription(parsed.description);
        if (parsed.primaryLabel !== undefined) setPrimaryLabel(parsed.primaryLabel);
        if (parsed.primaryValue !== undefined) setPrimaryValue(parsed.primaryValue);
        if (parsed.backgroundColor !== undefined) setBackgroundColor(parsed.backgroundColor);
        if (parsed.foregroundColor !== undefined) setForegroundColor(parsed.foregroundColor);
        if (parsed.labelColor !== undefined) setLabelColor(parsed.labelColor);
        if (parsed.barcodeValue !== undefined) setBarcodeValue(parsed.barcodeValue);
        if (parsed.barcodeFormat !== undefined) setBarcodeFormat(parsed.barcodeFormat);
        if (parsed.bgType !== undefined) setBgType(parsed.bgType);
      } catch (e) {
        console.error('Failed to parse localStorage data', e);
      }
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    const dataToSave = {
      logoText, description, primaryLabel, primaryValue,
      backgroundColor, foregroundColor, labelColor,
      barcodeValue, barcodeFormat, bgType
    };
    localStorage.setItem('walletPassData', JSON.stringify(dataToSave));
  }, [isLoaded, logoText, description, primaryLabel, primaryValue, backgroundColor, foregroundColor, labelColor, barcodeValue, barcodeFormat, bgType]);

  const presets = [
    { name: 'Midnight', bg: '#000000', fg: '#ffffff', lbl: '#a1a1aa', type: 'solid' },
    { name: 'Ivory', bg: '#f4f4f5', fg: '#18181b', lbl: '#71717a', type: 'solid' },
    { name: 'Nebula', bg: '#0ea5e9', fg: '#ffffff', lbl: '#e0e7ff', type: 'nebula' },
    { name: 'Retro 8-Bit', bg: '#120024', fg: '#00ffff', lbl: '#ff00ff', type: 'retro' },
    { name: 'Emerald', bg: '#064e3b', fg: '#ecfdf5', lbl: '#34d399', type: 'solid' },
  ];

  const applyPreset = (preset: typeof presets[0]) => {
    setBackgroundColor(preset.bg);
    setForegroundColor(preset.fg);
    setLabelColor(preset.lbl);
    setBgType(preset.type);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setPreviewUrl(URL.createObjectURL(selectedFile));
    setError(null);
    setSuccessMsg(null);
    
    await extractBarcode(selectedFile);
  };

  const extractBarcode = async (imageFile: File) => {
    setIsExtracting(true);
    setError(null);

    try {
      // Convert file to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
      });
      reader.readAsDataURL(imageFile);
      const base64DataUrl = await base64Promise;
      const base64Data = base64DataUrl.split(',')[1];

      const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            inlineData: {
              data: base64Data,
              mimeType: imageFile.type
            }
          },
          "Analyze this image and extract any barcode or QR code. Return the exact text/data encoded in the barcode, and identify its format. If no barcode is found, return empty strings."
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              barcodeValue: { type: Type.STRING },
              barcodeFormat: {
                type: Type.STRING,
                description: "Must be one of: PKBarcodeFormatQR, PKBarcodeFormatPDF417, PKBarcodeFormatAztec, PKBarcodeFormatCode128"
              }
            }
          }
        }
      });

      const result = JSON.parse(response.text || '{}');
      
      if (result.barcodeValue) {
        setBarcodeValue(result.barcodeValue);
        setBarcodeFormat(result.barcodeFormat || 'PKBarcodeFormatQR');
      } else {
        setError("No barcode could be found in the image. You can manually enter the value below.");
      }
    } catch (err: any) {
      console.error("Extraction error:", err);
      setError("Failed to extract barcode from image. " + (err.message || ""));
    } finally {
      setIsExtracting(false);
    }
  };

  const generatePass = async () => {
    if (!barcodeValue) {
      setError("Please provide a barcode value.");
      return;
    }

    setIsGenerating(true);
    setError(null);
    setSuccessMsg(null);

    try {
      let backgroundBase64 = null;
      if (bgType !== 'solid') {
        const canvas = document.createElement('canvas');
        canvas.width = 750;
        canvas.height = 1334;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          if (bgType === 'nebula') {
            const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
            grad.addColorStop(0, '#0ea5e9');
            grad.addColorStop(1, '#a855f7');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          } else if (bgType === 'retro') {
            const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
            grad.addColorStop(0, '#120024');
            grad.addColorStop(0.5, '#4a00e0');
            grad.addColorStop(1, '#ff00a0');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.strokeStyle = 'rgba(0, 255, 255, 0.15)';
            ctx.lineWidth = 4;
            for(let i=0; i<canvas.height; i+=40) {
              ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(canvas.width, i); ctx.stroke();
            }
            for(let i=0; i<canvas.width; i+=40) {
              ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke();
            }
          }
          backgroundBase64 = canvas.toDataURL('image/png').split(',')[1];
        }
      }

      const payload = {
        logoText,
        description,
        primaryLabel,
        primaryValue,
        backgroundColor: hexToRgbString(backgroundColor),
        foregroundColor: hexToRgbString(foregroundColor),
        labelColor: hexToRgbString(labelColor),
        barcodeValue,
        barcodeFormat,
        backgroundImage: backgroundBase64
      };

      const response = await fetch('/api/generate-pass', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to generate pass');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'pass.pkpass';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setSuccessMsg("Generating pass... Your Wallet should open shortly.");
    } catch (err: any) {
      console.error("Generation error:", err);
      setError(err.message || "An error occurred while generating the pass.");
    } finally {
      setTimeout(() => setIsGenerating(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      <header className="bg-white/80 backdrop-blur-md border-b border-zinc-200 py-6 px-4 sm:px-6 lg:px-8 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-zinc-900 p-2 rounded-xl shadow-lg">
              <Wallet className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-serif italic tracking-tight text-zinc-900">The Society <span className="text-zinc-400 font-sans not-italic text-sm font-light ml-2">Pass Creator</span></h1>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-20 px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-20">
          <h2 className="text-5xl font-serif italic tracking-tighter text-zinc-900 sm:text-7xl mb-6">
            Elevate your access.
          </h2>
          <p className="text-xl text-zinc-500 max-w-2xl mx-auto font-light leading-relaxed">
            Convert any barcode into a bespoke, high-end digital membership pass. Designed for the discerning.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          {/* Left Column: Form & Upload */}
          <div className="lg:col-span-7 space-y-8">
            
            {/* Upload Section */}
            <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-6">
              <h3 className="text-lg font-medium mb-4">1. Upload Barcode Image</h3>
              
              {!file ? (
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-zinc-300 rounded-xl p-12 text-center cursor-pointer hover:bg-zinc-50 hover:border-zinc-400 transition-colors"
                >
                  <UploadCloud className="w-10 h-10 text-zinc-400 mx-auto mb-4" />
                  <p className="text-sm font-medium text-zinc-900">Click to upload an image</p>
                  <p className="text-xs text-zinc-500 mt-1">PNG, JPG, or WEBP</p>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/*"
                    onChange={handleFileChange}
                  />
                </div>
              ) : (
                <div className="flex items-start space-x-6">
                  <div className="w-32 h-32 relative rounded-lg overflow-hidden border border-zinc-200 bg-zinc-100 flex-shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={previewUrl!} alt="Uploaded preview" className="object-cover w-full h-full" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium truncate max-w-[200px]">{file.name}</p>
                      <button 
                        onClick={() => {
                          setFile(null);
                          setPreviewUrl(null);
                          setBarcodeValue('');
                        }}
                        className="text-xs text-zinc-500 hover:text-zinc-900 underline"
                      >
                        Change image
                      </button>
                    </div>
                    
                    {isExtracting ? (
                      <div className="flex items-center space-x-2 text-sm text-indigo-600 bg-indigo-50 p-3 rounded-lg">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Extracting barcode data with AI...</span>
                      </div>
                    ) : barcodeValue ? (
                      <div className="flex items-start space-x-2 text-sm text-emerald-700 bg-emerald-50 p-3 rounded-lg">
                        <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-medium">Barcode extracted successfully</p>
                          <p className="text-emerald-600 text-xs mt-1 break-all">{barcodeValue}</p>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              )}
            </div>

            {/* Customization Form */}
            <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-6">
              <h3 className="text-lg font-medium mb-6">2. Customize Pass</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-700">Logo Text</label>
                  <input 
                    type="text" 
                    value={logoText}
                    onChange={(e) => setLogoText(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-700">Description</label>
                  <input 
                    type="text" 
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-700">Primary Label</label>
                  <input 
                    type="text" 
                    value={primaryLabel}
                    onChange={(e) => setPrimaryLabel(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-700">Primary Value</label>
                  <input 
                    type="text" 
                    value={primaryValue}
                    onChange={(e) => setPrimaryValue(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                
                <div className="col-span-full pt-4 border-t border-zinc-100">
                  <h4 className="text-sm font-medium text-zinc-900 mb-4">Design Presets</h4>
                  <div className="flex flex-wrap gap-3">
                    {presets.map((preset) => (
                      <button
                        key={preset.name}
                        onClick={() => applyPreset(preset)}
                        className="flex flex-col items-center space-y-1 group"
                      >
                        <div 
                          className="w-12 h-12 rounded-full border border-zinc-200 shadow-sm group-hover:scale-110 transition-transform"
                          style={{ 
                            background: preset.type === 'nebula' ? 'linear-gradient(135deg, #0ea5e9 0%, #a855f7 100%)' :
                                        preset.type === 'retro' ? 'linear-gradient(180deg, #120024 0%, #4a00e0 50%, #ff00a0 100%)' :
                                        preset.bg 
                          }}
                        />
                        <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">{preset.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="col-span-full pt-4 border-t border-zinc-100">
                  <h4 className="text-sm font-medium text-zinc-900 mb-4">Custom Colors</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs text-zinc-500 block">Background</label>
                      <div className="flex items-center space-x-2">
                        <input 
                          type="color" 
                          value={backgroundColor}
                          onChange={(e) => { setBackgroundColor(e.target.value); setBgType('solid'); }}
                          className="w-8 h-8 rounded cursor-pointer border-0 p-0"
                        />
                        <span className="text-xs font-mono uppercase text-zinc-600">{backgroundColor}</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs text-zinc-500 block">Foreground</label>
                      <div className="flex items-center space-x-2">
                        <input 
                          type="color" 
                          value={foregroundColor}
                          onChange={(e) => setForegroundColor(e.target.value)}
                          className="w-8 h-8 rounded cursor-pointer border-0 p-0"
                        />
                        <span className="text-xs font-mono uppercase text-zinc-600">{foregroundColor}</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs text-zinc-500 block">Label</label>
                      <div className="flex items-center space-x-2">
                        <input 
                          type="color" 
                          value={labelColor}
                          onChange={(e) => setLabelColor(e.target.value)}
                          className="w-8 h-8 rounded cursor-pointer border-0 p-0"
                        />
                        <span className="text-xs font-mono uppercase text-zinc-600">{labelColor}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="col-span-full pt-4 border-t border-zinc-100">
                  <h4 className="text-sm font-medium text-zinc-900 mb-4">Barcode Data</h4>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs text-zinc-500 block">Value</label>
                      <input 
                        type="text" 
                        value={barcodeValue}
                        onChange={(e) => setBarcodeValue(e.target.value)}
                        placeholder="Upload an image or type manually"
                        className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs text-zinc-500 block">Format</label>
                      <select 
                        value={barcodeFormat}
                        onChange={(e) => setBarcodeFormat(e.target.value)}
                        className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                      >
                        <option value="PKBarcodeFormatQR">QR Code</option>
                        <option value="PKBarcodeFormatPDF417">PDF417</option>
                        <option value="PKBarcodeFormatAztec">Aztec</option>
                        <option value="PKBarcodeFormatCode128">Code 128</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Error / Success Messages */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium">Error</p>
                  <p className="mt-1">{error}</p>
                </div>
              </div>
            )}

            {successMsg && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-4 rounded-xl flex items-start space-x-3">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium">Success</p>
                  <p className="mt-1">{successMsg}</p>
                </div>
              </div>
            )}

          </div>

          {/* Right Column: Preview & Action */}
          <div className="lg:col-span-5 space-y-8 sticky top-8">
            <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-6">
              <h3 className="text-lg font-medium mb-6">Live Preview</h3>
              
              {/* Apple Wallet Pass Mockup */}
              <div className="flex justify-center mb-8">
                <div 
                  className="w-full max-w-[320px] aspect-[10/16] rounded-[24px] shadow-xl overflow-hidden flex flex-col relative transition-all duration-500"
                  style={{ 
                    background: bgType === 'nebula' ? 'linear-gradient(135deg, #0ea5e9 0%, #a855f7 100%)' :
                                bgType === 'retro' ? 'linear-gradient(180deg, #120024 0%, #4a00e0 50%, #ff00a0 100%)' :
                                backgroundColor 
                  }}
                >
                  {bgType === 'retro' && (
                    <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(0, 255, 255, 0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 255, 255, 0.5) 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
                  )}
                  
                  {/* Header */}
                  <div className="px-6 py-6 flex items-center justify-start space-x-3 border-b border-white/10 relative z-10">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center border border-white/20 shadow-inner flex-shrink-0" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
                      <Wallet className="w-5 h-5" style={{ color: foregroundColor }} />
                    </div>
                    <div className="flex flex-col items-start text-left">
                      <h4 className={`text-[9px] font-bold uppercase tracking-[0.2em] mb-0.5 ${bgType === 'retro' ? 'font-mono' : ''}`} style={{ color: labelColor }}>
                        EST. 2026
                      </h4>
                      <span className={`text-xl tracking-tight leading-none ${bgType === 'retro' ? 'font-mono uppercase font-bold text-lg' : 'font-serif italic'}`} style={{ color: foregroundColor, textShadow: bgType === 'retro' ? '2px 2px 0px #ff00a0' : 'none' }}>
                        {logoText || 'The Society'}
                      </span>
                    </div>
                  </div>

                  {/* Body */}
                  <div className="px-8 py-10 flex flex-col items-center text-center flex-1 relative z-10">
                    <div className={`mb-2 text-[10px] font-bold uppercase tracking-[0.3em] ${bgType === 'retro' ? 'font-mono' : ''}`} style={{ color: labelColor }}>
                      {primaryLabel || 'Member Status'}
                    </div>
                    <div className={`text-4xl tracking-tighter ${bgType === 'retro' ? 'font-mono uppercase text-2xl mt-2 font-bold' : 'font-light'}`} style={{ color: foregroundColor, textShadow: bgType === 'retro' ? '3px 3px 0px #ff00a0' : 'none' }}>
                      {primaryValue || 'Founding Member'}
                    </div>
                    <div className="mt-8 w-12 h-[1px]" style={{ backgroundColor: labelColor, opacity: 0.3 }} />
                    <p className={`mt-6 text-[10px] leading-relaxed max-w-[200px] opacity-60 font-medium uppercase tracking-widest ${bgType === 'retro' ? 'font-mono' : ''}`} style={{ color: foregroundColor }}>
                      {description || 'Exclusive Access Pass'}
                    </p>
                  </div>

                  {/* Barcode Area */}
                  <div className="px-6 pb-10 pt-4 relative z-10">
                    <div className="bg-white/5 backdrop-blur-md rounded-2xl p-6 flex flex-col items-center justify-center space-y-4 border border-white/10">
                      {barcodeValue ? (
                        barcodeFormat === 'PKBarcodeFormatQR' ? (
                          <div className="p-2 bg-white rounded-lg">
                            <QRCode value={barcodeValue} size={140} level="M" />
                          </div>
                        ) : (
                          <div className="w-full h-20 bg-white/10 flex items-center justify-center border border-white/10 rounded-lg">
                            <span className="text-[10px] text-white/40 font-mono text-center px-2">
                              {barcodeFormat}<br/>{barcodeValue}
                            </span>
                          </div>
                        )
                      ) : (
                        <div className="w-32 h-32 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10 border-dashed">
                          <span className="text-[10px] text-white/20 uppercase tracking-widest">No Data</span>
                        </div>
                      )}
                      {barcodeValue && (
                        <div className="flex flex-col items-center space-y-1">
                          <span className="text-[9px] font-bold uppercase tracking-[0.2em]" style={{ color: labelColor }}>
                            Member ID
                          </span>
                          <span className="text-xs font-mono tracking-widest opacity-80" style={{ color: foregroundColor }}>
                            {barcodeValue}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={generatePass}
                disabled={isGenerating || !barcodeValue}
                className="w-full bg-zinc-900 hover:bg-black text-white rounded-2xl py-5 px-6 font-medium flex items-center justify-center space-x-3 transition-all duration-300 shadow-xl hover:shadow-2xl hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0 disabled:shadow-none"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span className="uppercase tracking-widest text-xs font-bold">Crafting Pass...</span>
                  </>
                ) : (
                  <>
                    <Wallet className="w-5 h-5" />
                    <span className="uppercase tracking-widest text-xs font-bold">Issue Membership Pass</span>
                  </>
                )}
              </button>
              <p className="text-xs text-center text-zinc-500 mt-4">
                Requires Apple Developer Certificates configured in settings to generate valid .pkpass files.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

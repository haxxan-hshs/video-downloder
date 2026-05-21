import React, { useState, useEffect } from 'react';
import { Link2, Download, CheckCircle, Clock, Video, Loader2, Settings, HardDrive, User, Edit2, Image as ImageIcon, AlertCircle, Info } from 'lucide-react';
import { supabase } from '../supabase';

const Dashboard = ({ user }) => {
  const [activeTab, setActiveTab] = useState('home');
  const [showDownloader, setShowDownloader] = useState(false);
  
  // Downloader state
  const [url, setUrl] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');
  const [downloadProgress, setDownloadProgress] = useState('');
  const [videoInfo, setVideoInfo] = useState(null);
  const [isFetchingInfo, setIsFetchingInfo] = useState(false);
  const [downloads, setDownloads] = useState([]);
  const [quality, setQuality] = useState('1080p');
  const [format, setFormat] = useState('mp4');

  // Profile state
  const [profileName, setProfileName] = useState('');
  const [profilePic, setProfilePic] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  useEffect(() => {
    // Load user metadata for profile
    if (user?.user_metadata) {
      setProfileName(user.user_metadata.full_name || '');
      setProfilePic(user.user_metadata.avatar_url || '');
    }

    const fetchDownloads = async () => {
      const { data, error } = await supabase
        .from('downloads')
        .select('*')
        .eq('username', user?.email)
        .order('created_at', { ascending: false });
        
      if (!error && data) {
        setDownloads(data);
      }
    };
    
    fetchDownloads();
  }, [user]);

  const handleDownload = async (e) => {
    e.preventDefault();
    if (!url.trim()) return;

    setIsDownloading(true);
    setDownloadError('');
    setDownloadProgress('Connecting to server...');

    try {
      const backendUrl = `http://localhost:3001/api/download?url=${encodeURIComponent(url.trim())}&quality=${quality}&format=${format}`;

      setDownloadProgress('Fetching video... this may take a moment');

      const response = await fetch(backendUrl);

      if (!response.ok) {
        // Try to parse error JSON
        let errMsg = 'Download failed. Please check the URL and try again.';
        try {
          const errData = await response.json();
          errMsg = errData.error || errMsg;
        } catch (_) {}
        throw new Error(errMsg);
      }

      setDownloadProgress('Downloading file...');

      // Get filename from Content-Disposition header
      const disposition = response.headers.get('Content-Disposition') || '';
      let filename = 'download';
      const match = disposition.match(/filename="?([^"]+)"?/);
      if (match) {
        try { filename = decodeURIComponent(match[1]); } catch (_) { filename = match[1]; }
      }

      // Stream the blob and trigger browser download
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);

      setDownloadProgress('✅ Download complete!');

      // Save to Supabase history
      const newDownload = {
        username: user?.email,
        url: url.trim(),
        title: videoInfo?.title || filename,
        status: 'completed',
        quality,
        format,
        size: 'Check Storage',
      };

      console.log('[History] Saving download:', newDownload);

      const { data, error } = await supabase
        .from('downloads')
        .insert([newDownload])
        .select();

      if (error) {
        console.error('[History] Supabase insert error:', error);
      } else if (data && data.length > 0) {
        console.log('[History] Saved successfully:', data[0]);
        setDownloads(prev => [data[0], ...prev]);
      }

      setUrl('');
      setVideoInfo(null);
      setTimeout(() => setDownloadProgress(''), 3000);

    } catch (err) {
      console.error('Download error:', err);
      setDownloadError(err.message || 'An unexpected error occurred.');
      setDownloadProgress('');
    } finally {
      setIsDownloading(false);
    }
  };

  // Fetch video info when URL is pasted
  const handleUrlChange = async (e) => {
    const val = e.target.value;
    setUrl(val);
    setDownloadError('');
    setVideoInfo(null);

    if (!val.trim() || val.length < 10) return;

    // Debounce: wait 800ms after user stops typing
    clearTimeout(window._infoTimer);
    window._infoTimer = setTimeout(async () => {
      if (!val.trim()) return;
      setIsFetchingInfo(true);
      try {
        const res = await fetch(`http://localhost:3001/api/info?url=${encodeURIComponent(val.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setVideoInfo(data);
        }
      } catch (_) {
        // Silently fail — info is optional
      } finally {
        setIsFetchingInfo(false);
      }
    }, 800);
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setIsSavingProfile(true);
    
    const { data, error } = await supabase.auth.updateUser({
      data: { 
        full_name: profileName,
        avatar_url: profilePic
      }
    });

    if (!error) {
      alert('Profile updated successfully!');
    } else {
      alert('Error updating profile: ' + error.message);
    }
    setIsSavingProfile(false);
  };

  // Upload image to Supabase Storage instead of using base64
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Show temporary local preview while uploading
    const reader = new FileReader();
    reader.onloadend = () => setProfilePic(reader.result);
    reader.readAsDataURL(file);
    
    setIsSavingProfile(true);

    try {
      // 1. Create a unique file name
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `profiles/${fileName}`;

      // 2. Upload the file to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      // 3. Get the public URL for the uploaded image
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // 4. Update state to the actual public URL so it saves on "Save Changes"
      setProfilePic(publicUrl);
      
    } catch (error) {
      alert('Error uploading image to storage: ' + error.message + '\nMake sure you created the "avatars" bucket!');
      console.error(error);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    if (isNaN(date)) return '';
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric'
    }).format(date);
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Tabs */}
      <div className="tabs-container">
        <button 
          className={`tab ${activeTab === 'home' ? 'active' : ''}`}
          onClick={() => setActiveTab('home')}
        >
          Home & Downloader
        </button>
        <button 
          className={`tab ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          Profile & History {downloads.length > 0 && (
            <span style={{ marginLeft: '6px', background: 'var(--primary)', color: 'white', borderRadius: '10px', padding: '1px 7px', fontSize: '11px' }}>
              {downloads.length}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'home' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="glass-panel" style={{ padding: '40px', textAlign: 'center' }}>
            <h2 style={{ fontSize: '32px', marginBottom: '16px', fontWeight: 700 }}>
              Welcome to <span className="gradient-text">NexusDownloader</span>
            </h2>
            <p style={{ fontSize: '18px', color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto 32px auto', lineHeight: '1.6' }}>
              <strong>The ultimate platform for high-speed video downloading.</strong> Paste any video link from major platforms, select your desired quality or audio format, and download directly to your storage in real-time.
            </p>

            {!showDownloader ? (
              <button 
                className="btn btn-primary" 
                style={{ padding: '16px 32px', fontSize: '18px' }}
                onClick={() => setShowDownloader(true)}
              >
                <Download size={24} /> Open Downloader Utility
              </button>
            ) : (
              <div className="animate-fade-in" style={{ marginTop: '24px', textAlign: 'left', borderTop: '1px solid var(--border)', paddingTop: '32px' }}>
                <h3 style={{ fontSize: '20px', marginBottom: '16px' }}>Video Downloader Tool</h3>
                <form onSubmit={handleDownload}>

                  {/* URL Input Row */}
                  <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '280px', position: 'relative' }}>
                      <Link2 size={20} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', zIndex: 1 }} />
                      <input
                        type="text"
                        className="input-field"
                        placeholder="Paste any video URL (YouTube, Instagram, TikTok, Facebook...)"
                        style={{ paddingLeft: '48px', paddingRight: '16px', height: '56px', fontSize: '16px' }}
                        value={url}
                        onChange={handleUrlChange}
                        disabled={isDownloading}
                      />
                    </div>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      style={{ height: '56px', padding: '0 32px', fontSize: '16px', flex: '0 0 auto' }}
                      disabled={isDownloading || !url.trim()}
                    >
                      {isDownloading ? (
                        <><Loader2 size={20} className="animate-spin-fast" /> Downloading...</>
                      ) : (
                        <><Download size={20} /> Download Now</>
                      )}
                    </button>
                  </div>

                  {/* Video Info Preview */}
                  {isFetchingInfo && (
                    <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                      <Loader2 size={14} className="animate-spin-fast" /> Fetching video info...
                    </div>
                  )}
                  {videoInfo && !isFetchingInfo && (
                    <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: 'rgba(99,102,241,0.1)', borderRadius: '8px', border: '1px solid rgba(99,102,241,0.3)' }}>
                      {videoInfo.thumbnail && (
                        <img src={videoInfo.thumbnail} alt="thumb" style={{ width: '64px', height: '40px', objectFit: 'cover', borderRadius: '4px', flexShrink: 0 }} />
                      )}
                      <div style={{ overflow: 'hidden' }}>
                        <p style={{ fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{videoInfo.title}</p>
                        <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          {videoInfo.uploader && `${videoInfo.uploader} • `}
                          {videoInfo.platform && `${videoInfo.platform} • `}
                          {videoInfo.duration ? `${Math.floor(videoInfo.duration / 60)}m ${videoInfo.duration % 60}s` : ''}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Error Message */}
                  {downloadError && (
                    <div style={{ marginTop: '12px', display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px 16px', background: 'rgba(239,68,68,0.1)', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.4)', color: '#f87171' }}>
                      <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '1px' }} />
                      <span style={{ fontSize: '13px' }}>{downloadError}</span>
                    </div>
                  )}

                  {/* Progress Message */}
                  {downloadProgress && !downloadError && (
                    <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', background: 'rgba(34,197,94,0.1)', borderRadius: '8px', border: '1px solid rgba(34,197,94,0.3)', color: '#4ade80' }}>
                      {downloadProgress.startsWith('✅') ? <CheckCircle size={16} /> : <Loader2 size={16} className="animate-spin-fast" />}
                      <span style={{ fontSize: '13px' }}>{downloadProgress}</span>
                    </div>
                  )}

                  {/* Quality & Format */}
                  <div style={{ display: 'flex', gap: '24px', marginTop: '24px', flexWrap: 'wrap' }}>
                    <div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                        <Settings size={14} /> Quality
                      </label>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {['4K', '1080p', '720p', '480p', 'Audio'].map(q => (
                          <button
                            key={q}
                            type="button"
                            className={`btn ${quality === q ? 'btn-primary' : 'btn-secondary'}`}
                            style={{ padding: '6px 12px', fontSize: '12px' }}
                            onClick={() => { setQuality(q); if (q === 'Audio') setFormat('mp3'); }}
                            disabled={isDownloading}
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                        <HardDrive size={14} /> Format
                      </label>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {['mp4', 'mkv', 'mp3'].map(f => (
                          <button
                            key={f}
                            type="button"
                            className={`btn ${format === f ? 'btn-primary' : 'btn-secondary'}`}
                            style={{ padding: '6px 12px', fontSize: '12px', textTransform: 'uppercase' }}
                            onClick={() => { setFormat(f); if (f === 'mp3') setQuality('Audio'); }}
                            disabled={isDownloading}
                          >
                            {f}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Cookies hint */}
                  <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    <Info size={13} />
                    Private/age-restricted videos ke liye project folder mein <strong style={{ color: 'var(--text-primary)' }}>cookies.txt</strong> file rakhein.
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'profile' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
          
          {/* Profile Card */}
          <div className="glass-panel animate-fade-in" style={{ padding: '32px' }}>
            <h3 style={{ fontSize: '20px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
              <User size={20} className="primary-gradient-text" /> My Profile
            </h3>
            
            <form onSubmit={handleProfileUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
                <div style={{ width: '100px', height: '100px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '2px solid var(--border)' }}>
                  {profilePic ? (
                    <img src={profilePic} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <User size={40} color="var(--text-secondary)" />
                  )}
                </div>
                <label className="btn btn-secondary" style={{ cursor: 'pointer', fontSize: '12px', padding: '6px 12px' }}>
                  <ImageIcon size={14} /> Upload Picture
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} />
                </label>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>Display Name</label>
                <div style={{ position: 'relative' }}>
                  <Edit2 size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Enter your name"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    style={{ paddingLeft: '40px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>Email (Read Only)</label>
                <input type="text" className="input-field" value={user?.email || ''} disabled style={{ opacity: 0.7 }} />
              </div>

              <button type="submit" className="btn btn-primary" disabled={isSavingProfile}>
                {isSavingProfile ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          </div>

          {/* History Card */}
          <div className="glass-panel animate-fade-in" style={{ padding: '32px' }}>
            <h3 style={{ fontSize: '20px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
              <Clock size={20} className="primary-gradient-text" /> My Download History
            </h3>
            
            {downloads.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
                <Video size={32} opacity={0.5} style={{ marginBottom: '16px' }} />
                <p>No downloads yet. Download a video to see history here.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '450px', overflowY: 'auto', paddingRight: '8px' }}>
                {downloads.map((item, index) => (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', padding: '14px 16px', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                    <CheckCircle size={18} color="var(--success)" style={{ flexShrink: 0, marginTop: '2px' }} />
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <h4 style={{ fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.title && item.title !== 'Media_Download' ? item.title : item.url}
                      </h4>
                      <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        {formatDate(item.created_at)} &nbsp;•&nbsp;
                        <span style={{ padding: '1px 6px', background: 'rgba(99,102,241,0.2)', borderRadius: '4px' }}>{item.quality}</span>
                        &nbsp;•&nbsp;
                        <span style={{ padding: '1px 6px', background: 'rgba(99,102,241,0.2)', borderRadius: '4px' }}>{item.format?.toUpperCase()}</span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};

export default Dashboard;

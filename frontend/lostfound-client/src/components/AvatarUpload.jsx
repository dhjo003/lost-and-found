import { useState } from "react";

export default function AvatarUpload({ jwt, onUploaded }) {
    const [preview, setPreview] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    function onFileChange(e) {
        setError(null);
        const file = e.target.files?.[0];
        if (!file) return;
        // quick client-side validation (size/type)
        if (!file.type.startsWith("image/")) {
            setError("Please choose an image file");
            return;
        }
        if (file.size > 2 * 1024 * 1024) {
            setError("File too large (max 2 MB)");
            return;
        }
        setPreview(URL.createObjectURL(file));
        upload(file);
    }

    async function upload(file) {
        setLoading(true);
        try {
            const body = new FormData();
            body.append("avatar", file);
            const res = await fetch("/api/users/me/avatar", {
                method: "POST",
                headers: {
                    Authorization: jwt ? `Bearer ${jwt}` : undefined,
                },
                body,
            });
            if (!res.ok) {
                const bodyText = await res.text();
                throw new Error(bodyText || `Upload failed: ${res.status}`);
            }
            const data = await res.json();
            // data.avatarUrl expected
            onUploaded?.(data.avatarUrl);
            setPreview(null);
        } catch (ex) {
            console.error(ex);
            setError("Upload failed");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label style={{ cursor: "pointer" }} title="Change avatar">
                <input type="file" accept="image/*" style={{ display: "none" }} onChange={onFileChange} />
                <button className="btn">Change</button>
            </label>
            {loading && <div>Uploading…</div>}
            {error && <div style={{ color: "red" }}>{error}</div>}
            {preview && <img src={preview} alt="preview" style={{ width: 40, height: 40, borderRadius: 8, objectFit: "cover" }} />}
        </div>
    );
}
import { Cloud, Plug, Mail, Upload } from "lucide-react";

export function SourceIcon({ source, className = "w-3 h-3" }: { source?: string; className?: string }) {
  switch (source) {
    case "google_drive":
      return <Cloud className={`${className} text-blue-500`} />;
    case "sharepoint":
      return <Plug className={`${className} text-blue-700`} />;
    case "onedrive":
      return <Cloud className={`${className} text-sky-500`} />;
    case "dropbox":
      return <Cloud className={`${className} text-blue-600`} />;
    case "email":
      return <Mail className={`${className} text-amber-500`} />;
    case "upload":
    default:
      return <Upload className={`${className} text-muted-foreground`} />;
  }
}

export function sourceLabel(source?: string): string {
  switch (source) {
    case "google_drive": return "Google Drive";
    case "sharepoint": return "SharePoint";
    case "onedrive": return "OneDrive";
    case "dropbox": return "Dropbox";
    case "email": return "Email";
    case "upload":
    default: return "Uploaded";
  }
}

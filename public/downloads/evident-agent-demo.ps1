# Evident Agent Demo Script
# This is a demonstration script for testing the Evident Agent enrollment and search flow
# Run as Administrator for full functionality
#
# USAGE:
#   .\evident-agent-demo.ps1                           # Normal mode - enroll and run heartbeat
#   .\evident-agent-demo.ps1 -WatchFolder "C:\Docs"    # Index a specific folder
#   .\evident-agent-demo.ps1 -SearchMode -SearchQuery "contract"  # Search indexed files
#   .\evident-agent-demo.ps1 -IndexOnly -WatchFolder "C:\Docs"    # Index only, then exit

param(
    [string]$ServerUrl = "https://evident-ai.net",
    [string]$EnrollmentToken = "",
    [string]$PairingCode = "",
    [string]$WatchFolder = "",
    [switch]$IndexOnly = $false,
    [switch]$SearchMode = $false,
    [string]$SearchQuery = ""
)

$ErrorActionPreference = "Stop"
$global:ConfigDir = "$env:ProgramData\Evident"
$global:ConfigPath = "$env:ProgramData\Evident\config.json"
$global:IndexPath = "$env:ProgramData\Evident\file-index.json"
$global:AllowedExtensions = @(".pdf", ".docx", ".xlsx", ".pptx", ".txt", ".doc", ".xls", ".csv", ".json", ".md")

# Ensure config directory exists
if (-not (Test-Path $global:ConfigDir)) {
    New-Item -ItemType Directory -Path $global:ConfigDir -Force | Out-Null
}

# ASCII Banner
Write-Host @"

  ______      _     _            _   
 |  ____|    (_)   | |          | |  
 | |____   __ _  __| | ___ _ __ | |_ 
 |  __\ \ / /| |/ _` |/ _ \ '_ \| __|
 | |___\ V / | | (_| |  __/ | | | |_ 
 |______\_/  |_|\__,_|\___|_| |_|\__|
                                     
  Enterprise Agent - Demo Mode v1.1.0
  
"@ -ForegroundColor Cyan

Write-Host "========================================" -ForegroundColor DarkGray
Write-Host "  Evident Agent Demo" -ForegroundColor White
Write-Host "  For demonstration purposes only" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor DarkGray
Write-Host ""

# ============================================
# FUNCTION: Index Files in a Folder
# ============================================
function Index-Folder {
    param([string]$FolderPath)
    
    if (-not (Test-Path $FolderPath)) {
        Write-Host "[ERROR] Folder not found: $FolderPath" -ForegroundColor Red
        return @()
    }
    
    Write-Host "[INDEXING] Scanning folder: $FolderPath" -ForegroundColor Cyan
    $startTime = Get-Date
    
    $files = Get-ChildItem -Path $FolderPath -Recurse -File -ErrorAction SilentlyContinue | 
        Where-Object { $global:AllowedExtensions -contains $_.Extension.ToLower() }
    
    $indexed = @()
    $count = 0
    
    foreach ($file in $files) {
        $count++
        
        # Read first 500 chars for preview/search
        $preview = ""
        try {
            if ($file.Extension -in @(".txt", ".csv", ".json", ".md")) {
                $content = Get-Content $file.FullName -Raw -ErrorAction SilentlyContinue
                if ($content) {
                    $preview = $content.Substring(0, [Math]::Min(500, $content.Length))
                }
            }
        } catch {}
        
        $fileInfo = @{
            id = [guid]::NewGuid().ToString()
            path = $file.FullName
            name = $file.Name
            extension = $file.Extension.ToLower()
            sizeBytes = $file.Length
            sizeMB = [math]::Round($file.Length / 1MB, 2)
            lastModified = $file.LastWriteTime.ToString("o")
            createdAt = $file.CreationTime.ToString("o")
            indexedAt = (Get-Date).ToString("o")
            preview = $preview
        }
        
        $indexed += $fileInfo
        
        if ($count % 50 -eq 0) {
            Write-Host "  Indexed $count files..." -ForegroundColor DarkGray
        }
    }
    
    $endTime = Get-Date
    $duration = ($endTime - $startTime).TotalSeconds
    
    Write-Host "[SUCCESS] Indexed $count files in $([math]::Round($duration, 2)) seconds" -ForegroundColor Green
    
    return $indexed
}

# ============================================
# FUNCTION: Save Index to Disk
# ============================================
function Save-Index {
    param([array]$Index)
    
    $indexData = @{
        version = 1
        createdAt = (Get-Date).ToString("o")
        fileCount = $Index.Count
        files = $Index
    }
    
    $indexData | ConvertTo-Json -Depth 10 | Set-Content $global:IndexPath -Encoding UTF8
    Write-Host "[INFO] Index saved to: $global:IndexPath" -ForegroundColor Cyan
}

# ============================================
# FUNCTION: Load Index from Disk
# ============================================
function Load-Index {
    if (-not (Test-Path $global:IndexPath)) {
        Write-Host "[WARNING] No index found. Run with -WatchFolder to create one." -ForegroundColor Yellow
        return @()
    }
    
    $indexData = Get-Content $global:IndexPath -Raw | ConvertFrom-Json
    Write-Host "[INFO] Loaded index with $($indexData.fileCount) files (created: $($indexData.createdAt))" -ForegroundColor Cyan
    return $indexData.files
}

# ============================================
# FUNCTION: Search Indexed Files
# ============================================
function Search-Index {
    param(
        [string]$Query,
        [array]$Index
    )
    
    if ($Index.Count -eq 0) {
        Write-Host "[ERROR] Index is empty. Run with -WatchFolder first." -ForegroundColor Red
        return @()
    }
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor DarkGray
    Write-Host "  SEARCH QUERY: $Query" -ForegroundColor White
    Write-Host "========================================" -ForegroundColor DarkGray
    
    $startTime = Get-Date
    
    $results = $Index | Where-Object {
        $_.name -like "*$Query*" -or 
        $_.path -like "*$Query*" -or 
        $_.preview -like "*$Query*"
    }
    
    $endTime = Get-Date
    $searchTimeMs = [math]::Round(($endTime - $startTime).TotalMilliseconds, 2)
    
    Write-Host ""
    Write-Host "[RESULTS] Found $($results.Count) matches in $searchTimeMs ms" -ForegroundColor Green
    Write-Host ""
    
    if ($results.Count -gt 0) {
        $rank = 0
        foreach ($result in $results | Select-Object -First 20) {
            $rank++
            Write-Host "  [$rank] $($result.name)" -ForegroundColor White
            Write-Host "      Path: $($result.path)" -ForegroundColor DarkGray
            Write-Host "      Size: $($result.sizeMB) MB | Modified: $($result.lastModified)" -ForegroundColor DarkGray
            
            if ($result.preview -and $result.preview -like "*$Query*") {
                $snippet = $result.preview -replace "`n", " " -replace "`r", ""
                if ($snippet.Length -gt 100) { $snippet = $snippet.Substring(0, 100) + "..." }
                Write-Host "      Preview: $snippet" -ForegroundColor DarkCyan
            }
            Write-Host ""
        }
        
        if ($results.Count -gt 20) {
            Write-Host "  ... and $($results.Count - 20) more results" -ForegroundColor DarkGray
        }
    }
    
    # Return timing info for API response
    return @{
        query = $Query
        resultCount = $results.Count
        searchTimeMs = $searchTimeMs
        results = $results | Select-Object -First 50
    }
}

# ============================================
# FUNCTION: Poll for Commands from Server
# ============================================
function Poll-Commands {
    param([string]$DeviceId)
    
    # In demo mode, check for local command file
    $commandFile = "$global:ConfigDir\pending-command.json"
    
    if (Test-Path $commandFile) {
        $command = Get-Content $commandFile -Raw | ConvertFrom-Json
        Remove-Item $commandFile -Force
        return $command
    }
    
    return $null
}

# ============================================
# FUNCTION: Execute Remote Search Command
# ============================================
function Execute-SearchCommand {
    param($Command)
    
    $query = $Command.query
    $requestId = $Command.requestId
    
    Write-Host "[COMMAND] Received search request: '$query' (ID: $requestId)" -ForegroundColor Magenta
    
    $index = Load-Index
    $searchResult = Search-Index -Query $query -Index $index
    
    # Save result for pickup
    $resultFile = "$global:ConfigDir\search-result-$requestId.json"
    $response = @{
        requestId = $requestId
        query = $query
        deviceId = $DeviceId
        timestamp = (Get-Date).ToString("o")
        searchTimeMs = $searchResult.searchTimeMs
        resultCount = $searchResult.resultCount
        results = $searchResult.results
    }
    
    $response | ConvertTo-Json -Depth 10 | Set-Content $resultFile -Encoding UTF8
    Write-Host "[COMMAND] Result saved to: $resultFile" -ForegroundColor Green
    
    return $response
}

# ============================================
# MAIN EXECUTION
# ============================================

# Check for admin rights
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "[WARNING] Not running as Administrator. Some features may be limited." -ForegroundColor Yellow
    Write-Host ""
}

# Get machine info
$machineId = (Get-WmiObject -Class Win32_ComputerSystemProduct).UUID
$hostname = $env:COMPUTERNAME
$username = $env:USERNAME

Write-Host "[INFO] Machine: $hostname | User: $username" -ForegroundColor DarkGray
Write-Host ""

# ============================================
# MODE: Search Only
# ============================================
if ($SearchMode) {
    if (-not $SearchQuery) {
        $SearchQuery = Read-Host "Enter search query"
    }
    
    $index = Load-Index
    $result = Search-Index -Query $SearchQuery -Index $index
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor DarkGray
    Write-Host "  Search completed" -ForegroundColor White
    Write-Host "  Query: $SearchQuery" -ForegroundColor DarkGray
    Write-Host "  Results: $($result.resultCount)" -ForegroundColor DarkGray
    Write-Host "  Time: $($result.searchTimeMs) ms" -ForegroundColor DarkGray
    Write-Host "========================================" -ForegroundColor DarkGray
    exit 0
}

# ============================================
# MODE: Index a Folder
# ============================================
if ($WatchFolder) {
    Write-Host "[MODE] File Indexing" -ForegroundColor Magenta
    Write-Host ""
    
    $indexed = Index-Folder -FolderPath $WatchFolder
    Save-Index -Index $indexed
    
    Write-Host ""
    Write-Host "Index Statistics:" -ForegroundColor White
    
    $byType = $indexed | Group-Object -Property extension
    foreach ($group in $byType | Sort-Object Count -Descending) {
        Write-Host "  $($group.Name): $($group.Count) files" -ForegroundColor DarkGray
    }
    
    $totalSize = ($indexed | Measure-Object -Property sizeBytes -Sum).Sum / 1MB
    Write-Host ""
    Write-Host "  Total: $($indexed.Count) files, $([math]::Round($totalSize, 2)) MB" -ForegroundColor Cyan
    
    if ($IndexOnly) {
        Write-Host ""
        Write-Host "[INFO] Index-only mode. Exiting." -ForegroundColor Yellow
        exit 0
    }
}

# ============================================
# ENROLLMENT
# ============================================
Write-Host "[STEP 1] Checking enrollment status..." -ForegroundColor Green
Start-Sleep -Milliseconds 500

$enrolled = Test-Path $global:ConfigPath
$DeviceId = ""

if ($enrolled) {
    $config = Get-Content $global:ConfigPath | ConvertFrom-Json
    $DeviceId = $config.deviceId
    Write-Host "[INFO] Device enrolled: $($config.orgName) (ID: $DeviceId)" -ForegroundColor Cyan
} else {
    Write-Host "[INFO] Device not enrolled. Starting enrollment..." -ForegroundColor Yellow
    
    if (-not $EnrollmentToken -and -not $PairingCode) {
        Write-Host ""
        $EnrollmentToken = Read-Host "  Enrollment Token (or press Enter for Pairing Code)"
        if (-not $EnrollmentToken) {
            $PairingCode = Read-Host "  Pairing Code"
        }
    }
    
    Write-Host "[STEP 2] Connecting to Evident server..." -ForegroundColor Green
    Start-Sleep -Seconds 1
    
    $DeviceId = [guid]::NewGuid().ToString()
    $demoConfig = @{
        deviceId = $DeviceId
        orgId = "demo-org-" + (Get-Random -Maximum 9999)
        orgName = "Demo Organization"
        enrolledAt = (Get-Date).ToString("o")
        machineId = $machineId
        hostname = $hostname
        status = "online"
    }
    
    $demoConfig | ConvertTo-Json | Set-Content $global:ConfigPath
    Write-Host "[SUCCESS] Enrolled! Device ID: $DeviceId" -ForegroundColor Green
}

Write-Host ""

# ============================================
# HEARTBEAT LOOP WITH COMMAND POLLING
# ============================================
Write-Host "[STEP 3] Starting agent service..." -ForegroundColor Green
Write-Host "[INFO] Press Ctrl+C to stop" -ForegroundColor Yellow
Write-Host "[TIP] To test remote search, create file: $global:ConfigDir\pending-command.json" -ForegroundColor DarkCyan
Write-Host '      Example: {"type":"SEARCH","query":"invoice","requestId":"test-123"}' -ForegroundColor DarkGray
Write-Host ""

$heartbeatCount = 0
try {
    while ($true) {
        $heartbeatCount++
        $timestamp = Get-Date -Format "HH:mm:ss"
        
        Write-Host "[$timestamp] Heartbeat #$heartbeatCount - Online" -ForegroundColor DarkGray
        
        # Check for pending commands
        $command = Poll-Commands -DeviceId $DeviceId
        if ($command) {
            if ($command.type -eq "SEARCH") {
                Execute-SearchCommand -Command $command
            }
        }
        
        Start-Sleep -Seconds 10
    }
} catch {
    Write-Host ""
    Write-Host "[INFO] Agent stopped" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Session ended. Config: $global:ConfigPath" -ForegroundColor DarkGray

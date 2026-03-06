!include "MUI2.nsh"
!include "LogicLib.nsh"

!define REMOVE_APP_DATA_ON_UNINSTALL false

; THIS STOPS ELECTRON BUILDER FROM DELETING APPDATA
!macro customRemoveFiles
  ; override default appdata removal
!macroend

; ================= INSTALL EXPERIENCE =================
!macro customInstall
  SetDetailsView show

  DetailPrint "Optimizing DSA Self Prepare..."
  Sleep 400

  DetailPrint "Configuring AI engine..."
  Sleep 600

  DetailPrint "Preparing learning environment..."
  Sleep 400

  DetailPrint "Creating desktop shortcut..."
  Sleep 300

  DetailPrint "Creating start menu entry..."
  Sleep 300

  DetailPrint "Finalizing installation..."
  Sleep 400
!macroend


; ================= UNINSTALL EXPERIENCE =================
!macro customUnInstall
  SetDetailsView show

  DetailPrint "Removing application files..."
  Sleep 300

  ; Ask about model deletion
  MessageBox MB_YESNO|MB_ICONQUESTION \
    "Do you also want to delete the downloaded AI model files and User Data? (This may free several GB of space)" \
    IDYES deleteModels IDNO skipModels

  deleteModels:
    DetailPrint "Removing downloaded AI models..."
    RMDir /r "$APPDATA\DSA-Self-Prepare-Models"
    Sleep 600
    Goto afterModels

  skipModels:
    DetailPrint "Keeping AI models for future reinstall..."
    Sleep 400
    Goto afterModels

  afterModels:
    DetailPrint "Cleaning system entries..."
    Sleep 300

  ; THIS REMOVES THE INSTALL DIRECTORY
    DetailPrint "Removing installation directory..."
    RMDir /r "$INSTDIR"

  DetailPrint "Uninstall complete."
  Sleep 300
!macroend

import docx
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

def set_cell_background(cell, fill_hex):
    tcPr = cell._element.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>')
    tcPr.append(shd)

def set_cell_margins(cell, top=100, bottom=100, left=150, right=150):
    tcPr = cell._element.get_or_add_tcPr()
    tcMar = parse_xml(
        f'<w:tcMar {nsdecls("w")}>'
        f'<w:top w:w="{top}" w:type="dxa"/>'
        f'<w:bottom w:w="{bottom}" w:type="dxa"/>'
        f'<w:left w:w="{left}" w:type="dxa"/>'
        f'<w:right w:w="{right}" w:type="dxa"/>'
        f'</w:tcMar>'
    )
    tcPr.append(tcMar)

def add_code_block(doc, code_text, language="dart"):
    table = doc.add_table(rows=1, cols=1)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    
    cell = table.cell(0, 0)
    cell.width = Inches(6.5)
    set_cell_background(cell, "F1F5F9")  # light slate gray
    set_cell_margins(cell, top=120, bottom=120, left=180, right=180)
    
    # Left border highlight
    tcPr = cell._element.get_or_add_tcPr()
    borders = parse_xml(
        f'<w:tcBorders {nsdecls("w")}>'
        f'<w:left w:val="single" w:sz="24" w:space="0" w:color="2563EB"/>'
        f'<w:top w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>'
        f'<w:right w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>'
        f'<w:bottom w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>'
        f'</w:tcBorders>'
    )
    tcPr.append(borders)
    
    p = cell.paragraphs[0]
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(0)
    p.paragraph_format.line_spacing = 1.15
    
    lines = code_text.strip().split('\n')
    for i, line in enumerate(lines):
        run = p.add_run(line)
        run.font.name = "Consolas"
        run.font.size = Pt(8.5)
        run.font.color.rgb = RGBColor(0x1E, 0x29, 0x3B)
        if i < len(lines) - 1:
            p.add_run("\n")
            
    doc.add_paragraph().paragraph_format.space_after = Pt(6)

def add_callout(doc, title, text, box_type="note"):
    colors = {
        "note": ("EFF6FF", "3B82F6", "1D4ED8"),     # Blue
        "tip": ("F0FDF4", "22C55E", "15803D"),      # Green
        "warning": ("FEFCE8", "EAB308", "A16207")   # Yellow
    }
    bg, border, text_col = colors.get(box_type, colors["note"])
    
    table = doc.add_table(rows=1, cols=1)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    
    cell = table.cell(0, 0)
    cell.width = Inches(6.5)
    set_cell_background(cell, bg)
    set_cell_margins(cell, top=100, bottom=100, left=160, right=160)
    
    tcPr = cell._element.get_or_add_tcPr()
    borders = parse_xml(
        f'<w:tcBorders {nsdecls("w")}>'
        f'<w:left w:val="single" w:sz="24" w:space="0" w:color="{border}"/>'
        f'<w:top w:val="none"/>'
        f'<w:right w:val="none"/>'
        f'<w:bottom w:val="none"/>'
        f'</w:tcBorders>'
    )
    tcPr.append(borders)
    
    p = cell.paragraphs[0]
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(2)
    
    r_title = p.add_run(f"📌 {title}: ")
    r_title.bold = True
    r_title.font.name = "Segoe UI"
    r_title.font.size = Pt(9.5)
    
    r_text = p.add_run(text)
    r_text.font.name = "Segoe UI"
    r_text.font.size = Pt(9.5)
    
    doc.add_paragraph().paragraph_format.space_after = Pt(4)

def format_table(table, col_widths, headers, rows_data):
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    
    # Headers
    hdr_cells = table.rows[0].cells
    for i, title in enumerate(headers):
        hdr_cells[i].text = title
        hdr_cells[i].width = Inches(col_widths[i])
        set_cell_background(hdr_cells[i], "1E3A8A")  # Deep Navy
        set_cell_margins(hdr_cells[i], top=100, bottom=100, left=120, right=120)
        p = hdr_cells[i].paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        for run in p.runs:
            run.font.bold = True
            run.font.name = "Segoe UI"
            run.font.size = Pt(9.5)
            run.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
            
    # Rows
    for row_idx, r_data in enumerate(rows_data):
        row_cells = table.add_row().cells
        bg_color = "F8FAFC" if row_idx % 2 == 1 else "FFFFFF"
        for i, val in enumerate(r_data):
            row_cells[i].text = val
            row_cells[i].width = Inches(col_widths[i])
            set_cell_background(row_cells[i], bg_color)
            set_cell_margins(row_cells[i], top=80, bottom=80, left=120, right=120)
            p = row_cells[i].paragraphs[0]
            for run in p.runs:
                run.font.name = "Segoe UI"
                run.font.size = Pt(9)
                run.font.color.rgb = RGBColor(0x33, 0x41, 0x55)

def build_document():
    doc = Document()
    
    # Page Setup - Standard Margins (1 inch)
    for section in doc.sections:
        section.top_margin = Inches(1)
        section.bottom_margin = Inches(1)
        section.left_margin = Inches(1)
        section.right_margin = Inches(1)
        
    # Document Title
    p_title = doc.add_paragraph()
    p_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_title.paragraph_format.space_before = Pt(12)
    p_title.paragraph_format.space_after = Pt(4)
    run_title = p_title.add_run("សៀវភៅណែនាំស្តីពីការកំណត់ និងតភ្ជាប់ Firebase\nជាមួយ Flutter Mobile App")
    run_title.font.name = "Segoe UI"
    run_title.font.size = Pt(20)
    run_title.font.bold = True
    run_title.font.color.rgb = RGBColor(0x1E, 0x3A, 0x8A)
    
    p_sub = doc.add_paragraph()
    p_sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_sub.paragraph_format.space_after = Pt(20)
    run_sub = p_sub.add_run("Full Implementation Guide: Commands, Native Configuration, Services & Code Setup\nគម្រោង KHY-HENG Attendance System")
    run_sub.font.name = "Segoe UI"
    run_sub.font.size = Pt(11)
    run_sub.font.color.rgb = RGBColor(0x64, 0x74, 0x8B)

    # Metadata Card Table
    meta_table = doc.add_table(rows=1, cols=4)
    meta_headers = ["Project ID", "Application ID (Android)", "iOS Bundle ID", "Flutter Target"]
    meta_values = [["khy-heng", "com.hrchomnan.mobile_app", "com.hrchomnan.mobileApp", "Android / iOS / Web"]]
    format_table(meta_table, [1.4, 2.0, 1.8, 1.3], meta_headers, meta_values)
    doc.add_paragraph().paragraph_format.space_after = Pt(12)

    # --- SECTION 1 ---
    h1 = doc.add_heading("១. ទិដ្ឋភាពទូទៅនៃ Firebase Services ក្នុង Mobile App", level=1)
    h1.paragraph_format.space_before = Pt(16)
    h1.paragraph_format.space_after = Pt(6)
    for r in h1.runs:
        r.font.name = "Segoe UI"
        r.font.color.rgb = RGBColor(0x1E, 0x3A, 0x8A)
        
    p = doc.add_paragraph("នៅក្នុងកម្មវិធីទូរស័ព្ទដៃ KHY-HENG Attendance នេះ សេវាកម្មរបស់ Google Firebase ត្រូវបានរៀបចំឡើងយ៉ាងពេញលេញ ដើម្បីធានាដំណើរការរលូន សុវត្ថិភាពខ្ពស់ និងភាពងាយស្រួលក្នុងការគ្រប់គ្រងពីចម្ងាយ (Remote Management)។ ខាងក្រោមជាសេវាកម្មសំខាន់ៗទាំង ៤ ដែលត្រូវបានប្រើប្រាស់៖")
    p.paragraph_format.line_spacing = 1.25

    srv_table = doc.add_table(rows=1, cols=3)
    srv_headers = ["Firebase Service", "កញ្ចប់ Plugin (Pub)", "តួនាទី និងភារកិច្ចក្នុង App"]
    srv_rows = [
        ["Firebase Core", "firebase_core: ^4.14.0", "Initialize ភ្ជាប់ទៅកាន់ Firebase Console នៅពេល App ចាប់ផ្តើម"],
        ["Firebase Remote Config", "firebase_remote_config: ^6.7.0", "គ្រប់គ្រង IP/Domain Server, Maintenance Mode, និង Feature Toggles ពីចម្ងាយ Realtime"],
        ["Firebase Cloud Messaging (FCM)", "firebase_messaging: ^16.7.0", "ទទួល Push Notifications ទាំងពេល App បើក (Foreground) ឬបិទ (Background/Terminated)"],
        ["Firebase Analytics", "firebase_analytics: ^12.6.0", "កត់ត្រាស្ថិតិអ្នកប្រើប្រាស់ តាមដាន Screen Navigation និង Event Check-in / Leave / OT"]
    ]
    format_table(srv_table, [1.8, 2.0, 2.7], srv_headers, srv_rows)
    doc.add_paragraph().paragraph_format.space_after = Pt(10)

    # --- SECTION 2 ---
    h1 = doc.add_heading("២. ឧបករណ៍តម្រូវ និង Command Setup ដំបូង (CLI Commands)", level=1)
    h1.paragraph_format.space_before = Pt(16)
    h1.paragraph_format.space_after = Pt(6)
    for r in h1.runs:
        r.font.name = "Segoe UI"
        r.font.color.rgb = RGBColor(0x1E, 0x3A, 0x8A)

    doc.add_paragraph("ដើម្បីអាចភ្ជាប់ Flutter App ទៅកាន់ Firebase បានត្រឹមត្រូវ អ្នកត្រូវដំណើរការ Command ជាបន្តបន្ទាប់ដូចខាងក្រោម៖")
    
    h2 = doc.add_heading("ជំហានទី ២.១៖ ដំឡើង Firebase CLI និង FlutterFire CLI", level=2)
    h2.paragraph_format.space_before = Pt(10)
    for r in h2.runs:
        r.font.name = "Segoe UI"
        r.font.color.rgb = RGBColor(0x25, 0x63, 0xEB)
        
    doc.add_paragraph("បើក Terminal (Command Prompt / PowerShell) រួចដំណើរការបញ្ជា៖")
    add_code_block(doc, """# ១. ដំឡើង Firebase CLI តាមរយៈ npm (តម្រូវឱ្យមាន Node.js)
npm install -g firebase-tools

# ២. Login ចូលទៅកាន់ Google Account ដែលជាម្ចាស់ Project Firebase
firebase login

# ៣. ដំឡើង FlutterFire CLI ជាសកល (Global)
dart pub global activate flutterfire_cli""")

    h2 = doc.add_heading("ជំហានទី ២.២៖ ដំណើរការ FlutterFire Configure ក្នុង Project", level=2)
    h2.paragraph_format.space_before = Pt(10)
    for r in h2.runs:
        r.font.name = "Segoe UI"
        r.font.color.rgb = RGBColor(0x25, 0x63, 0xEB)

    doc.add_paragraph("ចូលទៅកាន់ Folder របស់ Mobile App រួចដំណើរការ Command ខាងក្រោមដើម្បី Generate ឯកសារ `firebase_options.dart` និងទាញយក `google-services.json` ដោយស្វ័យប្រវត្តិ៖")
    add_code_block(doc, """# ចូលទៅកាន់ Directory របស់ Mobile App
cd d:/project/KHY-HENG_Attendance/mobile_app

# ដំណើរការ configure ភ្ជាប់ទៅកាន់ project khy-heng
flutterfire configure --project=khy-heng""")
    
    add_callout(doc, "លទ្ធផលទទួលបាន (Generated Files)", 
                "បន្ទាប់ពី configure រួចរាល់ ប្រព័ន្ធនឹងបង្កើតឯកសារ lib/firebase_options.dart និង android/app/google-services.json ដោយស្វ័យប្រវត្តិ។", "tip")

    # --- SECTION 3 ---
    h1 = doc.add_heading("៣. ការកំណត់ Dependencies ក្នុង pubspec.yaml", level=1)
    h1.paragraph_format.space_before = Pt(16)
    h1.paragraph_format.space_after = Pt(6)
    for r in h1.runs:
        r.font.name = "Segoe UI"
        r.font.color.rgb = RGBColor(0x1E, 0x3A, 0x8A)

    doc.add_paragraph("បន្ថែម Packages ខាងក្រោមនៅក្នុងឯកសារ `pubspec.yaml` ឬដំណើរការ command `flutter pub add`៖")
    add_code_block(doc, """# ដំណើរការ Command បន្ថែម Packages
flutter pub add firebase_core firebase_messaging firebase_remote_config firebase_analytics flutter_local_notifications""")

    doc.add_paragraph("ផ្នែក `dependencies` ក្នុង `pubspec.yaml` នឹងមានទម្រង់ដូចខាងក្រោម៖")
    add_code_block(doc, """dependencies:
  flutter:
    sdk: flutter

  # Firebase Plugins
  firebase_core: ^4.14.0
  firebase_remote_config: ^6.7.0
  firebase_messaging: ^16.7.0
  firebase_analytics: ^12.6.0

  # Local Notification សម្រាប់ Status Bar Alert
  flutter_local_notifications: ^22.3.1
  workmanager: ^0.10.10""")

    # --- SECTION 4 ---
    h1 = doc.add_heading("៤. ការកំណត់ Platform Native Config (Android Gradle)", level=1)
    h1.paragraph_format.space_before = Pt(16)
    h1.paragraph_format.space_after = Pt(6)
    for r in h1.runs:
        r.font.name = "Segoe UI"
        r.font.color.rgb = RGBColor(0x1E, 0x3A, 0x8A)

    doc.add_paragraph("គម្រោងនេះប្រើប្រាស់ Kotlin DSL (`.gradle.kts`)។ ខាងក្រោមជាចំណុចសំខាន់ៗដែលត្រូវ config លើ Android៖")

    h2 = doc.add_heading("ជំហានទី ៤.១៖ android/settings.gradle.kts", level=2)
    h2.paragraph_format.space_before = Pt(10)
    for r in h2.runs:
        r.font.name = "Segoe UI"
        r.font.color.rgb = RGBColor(0x25, 0x63, 0xEB)
        
    doc.add_paragraph("ត្រូវប្រាកដថាបានបញ្ចូល `com.google.gms.google-services` នៅក្នុង `plugins` block:")
    add_code_block(doc, """plugins {
    id("dev.flutter.flutter-plugin-loader") version "1.0.0"
    id("com.android.application") version "8.11.1" apply false
    // START: FlutterFire Configuration
    id("com.google.gms.google-services") version("4.4.4") apply false
    // END: FlutterFire Configuration
    id("org.jetbrains.kotlin.android") version "2.2.20" apply false
}""")

    h2 = doc.add_heading("ជំហានទី ៤.២៖ android/app/build.gradle.kts", level=2)
    h2.paragraph_format.space_before = Pt(10)
    for r in h2.runs:
        r.font.name = "Segoe UI"
        r.font.color.rgb = RGBColor(0x25, 0x63, 0xEB)
        
    doc.add_paragraph("Apply plugin `com.google.gms.google-services` និងបើកដំណើរការ `coreLibraryDesugaring` (ដើម្បីគាំទ្រ Java 8+ features សម្រាប់ Firebase និង WorkManager)៖")
    add_code_block(doc, """plugins {
    id("com.android.application")
    // Apply Google Services Plugin
    id("com.google.gms.google-services")
    id("kotlin-android")
    id("dev.flutter.flutter-gradle-plugin")
}

android {
    namespace = "com.hrchomnan.mobile_app"
    compileSdk = 37

    compileOptions {
        isCoreLibraryDesugaringEnabled = true
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        applicationId = "com.hrchomnan.mobile_app"
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }
}

dependencies {
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.4")
}""")

    h2 = doc.add_heading("ជំហានទី ៤.៣៖ android/app/src/main/AndroidManifest.xml", level=2)
    h2.paragraph_format.space_before = Pt(10)
    for r in h2.runs:
        r.font.name = "Segoe UI"
        r.font.color.rgb = RGBColor(0x25, 0x63, 0xEB)
        
    doc.add_paragraph("បន្ថែមសិទ្ធិ (Permissions) សម្រាប់ Push Notification និង Meta-data របស់ FCM Channel៖")
    add_code_block(doc, """<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <!-- Permissions សម្រាប់ Network & Notifications -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    <uses-permission android:name="android.permission.VIBRATE" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />
    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />

    <application
        android:label="HR chomnan"
        android:icon="@mipmap/ic_launcher"
        android:usesCleartextTraffic="true">
        
        <!-- FCM Default Notification Channel ID & Icon -->
        <meta-data
            android:name="com.google.firebase.messaging.default_notification_channel_id"
            android:value="attendance_push_channel" />
        <meta-data
            android:name="com.google.firebase.messaging.default_notification_icon"
            android:resource="@mipmap/ic_launcher" />

        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:launchMode="singleTop"
            ... >
        </activity>
    </application>
</manifest>""")

    # --- SECTION 5 ---
    h1 = doc.add_heading("៥. កូដអនុវត្តជាក់ស្តែងក្នុង Flutter (Full Code Implementation)", level=1)
    h1.paragraph_format.space_before = Pt(16)
    h1.paragraph_format.space_after = Pt(6)
    for r in h1.runs:
        r.font.name = "Segoe UI"
        r.font.color.rgb = RGBColor(0x1E, 0x3A, 0x8A)

    doc.add_paragraph("ខាងក្រោមនេះជាកូដជាក់ស្តែង និងរចនាសម្ព័ន្ធ Services នីមួយៗដែលត្រូវបានបង្កើត និងរៀបចំយ៉ាងល្អក្នុង Project៖")

    # 5.1 Main Init
    h2 = doc.add_heading("៥.១ Firebase Initialization ក្នុង lib/main.dart", level=2)
    h2.paragraph_format.space_before = Pt(10)
    for r in h2.runs:
        r.font.name = "Segoe UI"
        r.font.color.rgb = RGBColor(0x25, 0x63, 0xEB)

    doc.add_paragraph("នៅក្នុង `main.dart` Firebase ត្រូវបាន Initialize ដោយប្រើ Try-Catch ការពារកុំឱ្យគាំង UI និងដំណើរការ Services ផ្សេងៗជា Asynchronous Background៖")
    add_code_block(doc, """import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'firebase_options.dart';
import 'core/services/remote_config_service.dart';
import 'core/services/analytics_service.dart';
import 'core/services/background_notification_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // ១. Initialize Firebase safely
  try {
    await Firebase.initializeApp(
      options: DefaultFirebaseOptions.currentPlatform,
    );
    // ចុះឈ្មោះ FCM Background Handler
    FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
  } catch (e) {
    debugPrint('[Firebase Init Warning]: $e');
  }
  
  // ២. បើកដំណើរការ Flutter UI ភ្លាមៗ (មិនឱ្យរង់ចាំយូរ)
  runApp(const HrAttendanceApp());

  // ៣. បើក Services ផ្សេងៗជា Async Concurrent
  _initAsyncServices();
}

void _initAsyncServices() {
  Future.microtask(() async {
    await AnalyticsService().init();
    await RemoteConfigService().init();
    await BackgroundNotificationService().init();
  });
}""")

    # 5.2 Remote Config
    h2 = doc.add_heading("៥.២ Firebase Remote Config Service (lib/core/services/remote_config_service.dart)", level=2)
    h2.paragraph_format.space_before = Pt(10)
    for r in h2.runs:
        r.font.name = "Segoe UI"
        r.font.color.rgb = RGBColor(0x25, 0x63, 0xEB)

    doc.add_paragraph("Remote Config អនុញ្ញាតឱ្យ Admin កែប្រែ IP Address របស់ Server, បើក Maintenance Mode ឬបិទ/បើក Face Recognition ពីចម្ងាយដោយ Realtime៖")
    add_code_block(doc, """import 'package:firebase_remote_config/firebase_remote_config.dart';
import 'package:flutter/foundation.dart';
import 'package:get/get.dart';
import '../constants/api_config.dart';
import 'base_api_client.dart';
import 'http_api_client.dart';
import '../../views/maintenance_screen.dart';

class RemoteConfigService {
  static final RemoteConfigService _instance = RemoteConfigService._internal();
  factory RemoteConfigService() => _instance;
  RemoteConfigService._internal();

  FirebaseRemoteConfig? _remoteConfig;

  FirebaseRemoteConfig? get instance {
    try {
      _remoteConfig ??= FirebaseRemoteConfig.instance;
      return _remoteConfig;
    } catch (e) {
      debugPrint('[RemoteConfig Warning]: $e');
      return null;
    }
  }

  Future<void> init() async {
    final rc = instance;
    if (rc == null) return;

    try {
      // កំណត់ fetch settings
      await rc.setConfigSettings(RemoteConfigSettings(
        fetchTimeout: const Duration(seconds: 5),
        minimumFetchInterval: Duration.zero, // Realtime
      ));

      // កំណត់តម្លៃលំនាំដើម (Defaults)
      await rc.setDefaults({
        'server_host': ApiConfig.defaultServerHost,
        'is_maintenance_mode': false,
        'maintenance_message': 'ប្រព័ន្ធកំពុងដំណើរការកែលម្អ សូមព្យាយាមម្តងទៀតនៅពេលក្រោយ។',
        'min_app_version': '1.0.0',
        'enable_face_recognition': true,
      });

      // Fetch & Activate ភ្លាមៗ
      await rc.fetchAndActivate();

      // Realtime listener ចាប់ការកែប្រែពី Firebase Console
      rc.onConfigUpdated.listen((event) async {
        await rc.activate();
        debugPrint('[RemoteConfig Realtime] server_host: $serverHost');

        if (Get.isRegistered<BaseApiClient>()) {
          final client = Get.find<BaseApiClient>();
          if (client is HttpApiClient) {
            client.updateServerHost(serverHost);
          }
        }

        if (isMaintenanceMode) {
          Get.offAll(() => const MaintenanceScreen());
        }
      });
    } catch (e) {
      debugPrint('Error init Remote Config: $e');
    }
  }

  String get serverHost => instance?.getString('server_host').trim() ?? ApiConfig.defaultServerHost;
  bool get isMaintenanceMode => instance?.getBool('is_maintenance_mode') ?? false;
  String get maintenanceMessage => instance?.getString('maintenance_message') ?? 'ប្រព័ន្ធកំពុងកែលម្អ';
  String get minAppVersion => instance?.getString('min_app_version') ?? '1.0.0';
  bool get enableFaceRecognition => instance?.getBool('enable_face_recognition') ?? true;
}""")

    # 5.3 FCM
    h2 = doc.add_heading("៥.៣ Firebase Cloud Messaging - FCM (lib/core/services/background_notification_service.dart)", level=2)
    h2.paragraph_format.space_before = Pt(10)
    for r in h2.runs:
        r.font.name = "Segoe UI"
        r.font.color.rgb = RGBColor(0x25, 0x63, 0xEB)

    doc.add_paragraph("គ្រប់គ្រងការទទួល Push Notification និងដោះស្រាយ Background Payload ដោយមិនបាត់បង់ Notification ពេលទូរស័ព្ទចាក់សោ ឬបិទ App៖")
    add_code_block(doc, """import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../firebase_options.dart';
import 'local_notification_service.dart';

/// Top-level background execution handler
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  try {
    WidgetsFlutterBinding.ensureInitialized();
    await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);

    final notification = message.notification;
    final data = message.data;
    final String title = notification?.title ?? data['title'] ?? 'HR Notification';
    final String body = notification?.body ?? data['body'] ?? '';

    // បង្ហាញ Local notification ប្រសិនបើជា data-only message
    if (notification == null && (title.isNotEmpty || body.isNotEmpty)) {
      await LocalNotificationService().showPushNotification(
        title: title,
        body: body,
        payload: data['targetId'] ?? data['id'],
      );
    }
  } catch (e) {
    debugPrint('[FCM Background Error]: $e');
  }
}

class BackgroundNotificationService {
  static final BackgroundNotificationService _instance = BackgroundNotificationService._internal();
  factory BackgroundNotificationService() => _instance;
  BackgroundNotificationService._internal();

  FirebaseMessaging? get fcm => FirebaseMessaging.instance;

  Future<void> init() async {
    final messaging = fcm;
    if (messaging == null) return;

    // ស្នើសុំ Permission លើ iOS & Android 13+
    await messaging.requestPermission(alert: true, badge: true, sound: true);

    // Foreground listener
    FirebaseMessaging.onMessage.listen((RemoteMessage message) {
      final notif = message.notification;
      final data = message.data;
      LocalNotificationService().showPushNotification(
        title: notif?.title ?? data['title'] ?? 'HR Notification',
        body: notif?.body ?? data['body'] ?? '',
      );
    });

    // Subscribe ចូល Topics សំខាន់ៗ
    await messaging.subscribeToTopic('all_employees');
  }

  // Subscribe តាមបុគ្គលិក និងដេប៉ាតឺម៉ង់
  Future<void> subscribeUserTopics({required String staffId, String? departmentId}) async {
    final messaging = fcm;
    if (messaging == null) return;

    final cleanStaff = staffId.trim().replaceAll(RegExp(r'[^a-zA-Z0-9_-]'), '_');
    await messaging.subscribeToTopic('staff_$cleanStaff');

    if (departmentId != null && departmentId.isNotEmpty) {
      final cleanDept = departmentId.trim().replaceAll(RegExp(r'[^a-zA-Z0-9_-]'), '_');
      await messaging.subscribeToTopic('dept_$cleanDept');
    }

    // ចាប់យក Device Token រក្សាទុកក្នុង Local Storage
    final fcmToken = await messaging.getToken();
    if (fcmToken != null) {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('fcm_device_token', fcmToken);
      debugPrint('[FCM] Device Token: $fcmToken');
    }
  }
}""")

    # 5.4 Analytics
    h2 = doc.add_heading("៥.៤ Firebase Analytics Service (lib/core/services/analytics_service.dart)", level=2)
    h2.paragraph_format.space_before = Pt(10)
    for r in h2.runs:
        r.font.name = "Segoe UI"
        r.font.color.rgb = RGBColor(0x25, 0x63, 0xEB)

    doc.add_paragraph("តាមដានស្ថិតិសកម្មភាព និងព្រឹត្តិការណ៍សំខាន់ៗក្នុងប្រព័ន្ធ (Events Logging)៖")
    add_code_block(doc, """import 'package:firebase_analytics/firebase_analytics.dart';
import 'package:flutter/foundation.dart';

class AnalyticsService {
  static final AnalyticsService _instance = AnalyticsService._internal();
  factory AnalyticsService() => _instance;
  AnalyticsService._internal();

  FirebaseAnalytics? get analytics => FirebaseAnalytics.instance;
  FirebaseAnalyticsObserver? get observer => FirebaseAnalyticsObserver(analytics: analytics!);

  Future<void> init() async {
    await analytics?.setAnalyticsCollectionEnabled(true);
    await analytics?.logAppOpen();
  }

  Future<void> setUserProfile({required String staffId, String? role, String? branch, String? department}) async {
    await analytics?.setUserId(id: staffId);
    if (role != null) await analytics?.setUserProperty(name: 'user_role', value: role);
    if (branch != null) await analytics?.setUserProperty(name: 'branch_name', value: branch);
    if (department != null) await analytics?.setUserProperty(name: 'department', value: department);
  }

  Future<void> logCheckIn({required String method, required String branchName, required bool success}) async {
    await analytics?.logEvent(
      name: 'attendance_check_in',
      parameters: {'method': method, 'branch': branchName, 'status': success ? 'success' : 'failed'},
    );
  }

  Future<void> logLeaveRequest({required String leaveType, required double durationDays}) async {
    await analytics?.logEvent(
      name: 'submit_leave_request',
      parameters: {'leave_type': leaveType, 'duration_days': durationDays},
    );
  }
}""")

    # --- SECTION 6 ---
    h1 = doc.add_heading("៦. របៀបកំណត់នៅលើ Firebase Console (Console Setup Guide)", level=1)
    h1.paragraph_format.space_before = Pt(16)
    h1.paragraph_format.space_after = Pt(6)
    for r in h1.runs:
        r.font.name = "Segoe UI"
        r.font.color.rgb = RGBColor(0x1E, 0x3A, 0x8A)

    doc.add_paragraph("នៅពេលបើកគេហទំព័រ https://console.firebase.google.com/ ជ្រើសរើស Project: `khy-heng` ហើយអ្នកអាចកំណត់ដូចខាងក្រោម៖")

    h2 = doc.add_heading("៦.១ ការបង្កើត Parameters ក្នុង Firebase Remote Config", level=2)
    h2.paragraph_format.space_before = Pt(10)
    for r in h2.runs:
        r.font.name = "Segoe UI"
        r.font.color.rgb = RGBColor(0x25, 0x63, 0xEB)

    doc.add_paragraph("ចូលទៅកាន់ Run -> Remote Config -> ចុច Add parameter ឬ Create configuration រួចបញ្ចូល Key & Value ដូចតារាងខាងក្រោម៖")
    
    rc_table = doc.add_table(rows=1, cols=4)
    rc_headers = ["Parameter Key", "Data Type", "Default Value", "ការពិពណ៌នា"]
    rc_rows = [
        ["server_host", "String", "10.10.1.186", "IP Address ឬ Domain របស់ Server Backend API"],
        ["is_maintenance_mode", "Boolean", "false", "ដាក់ true ដើម្បីបិទ App ពេលកំពុង Upgrade ប្រព័ន្ធ"],
        ["maintenance_message", "String", "ប្រព័ន្ធកំពុងដំណើរការកែលម្អ...", "សារជូនដំណឹងពេល Maintenance"],
        ["min_app_version", "String", "1.0.0", "Version អប្បបរមាដែលតម្រូវឱ្យបុគ្គលិក Update"],
        ["enable_face_recognition", "Boolean", "true", "បើក ឬបិទមុខងារ Face Scan Attendance"]
    ]
    format_table(rc_table, [1.8, 1.1, 1.4, 2.2], rc_headers, rc_rows)
    doc.add_paragraph().paragraph_format.space_after = Pt(8)

    add_callout(doc, "សំខាន់", "រាល់ពេលកែប្រែ Parameter រួច អ្នកត្រូវចុចប៊ូតុង [Publish changes] នៅជ្រុងខាងស្តាំខាងលើ ទើប App ទទួលបានការ Update Realtime។", "warning")

    h2 = doc.add_heading("៦.២ ការផ្ញើ Push Notification តាម Messaging Console", level=2)
    h2.paragraph_format.space_before = Pt(10)
    for r in h2.runs:
        r.font.name = "Segoe UI"
        r.font.color.rgb = RGBColor(0x25, 0x63, 0xEB)

    doc.add_paragraph("ចូលទៅកាន់ Engage -> Messaging -> ចុច [New campaign] -> [Firebase Notification messages]៖")
    doc.add_paragraph("១. បញ្ចូល Notification Title និង Notification Text\n"
                      "២. ត្រង់ចំណុច Target ជ្រើសរើស [Topic] -> វាយបញ្ចូលពាក្យ `all_employees` (សម្រាប់ផ្ញើទៅបុគ្គលិកទាំងអស់) ឬ `dept_IT` (តាមដេប៉ាតឺម៉ង់)\n"
                      "៣. Scheduling: ជ្រើសរើស Now ឬកំណត់ម៉ោងផ្ញើទុកជាមុន\n"
                      "៤. ចុច [Review] រួចចុច [Publish] ជាការស្រេច។")

    # --- SECTION 7 ---
    h1 = doc.add_heading("៧. គន្លឹះដោះស្រាយបញ្ហា (Troubleshooting & FAQs)", level=1)
    h1.paragraph_format.space_before = Pt(16)
    h1.paragraph_format.space_after = Pt(6)
    for r in h1.runs:
        r.font.name = "Segoe UI"
        r.font.color.rgb = RGBColor(0x1E, 0x3A, 0x8A)

    faq_table = doc.add_table(rows=1, cols=2)
    faq_headers = ["បញ្ហាដែលជួបប្រទះ (Issues)", "ដំណោះស្រាយ (Solutions)"]
    faq_rows = [
        ["Notification មិនលោតលើ Android 13+", "ត្រូវប្រាកដថាបានដាក់សិទ្ធិ POST_NOTIFICATIONS ក្នុង AndroidManifest.xml និងបានហៅ requestPermission() ក្នុង Flutter"],
        ["Build Android ជាប់ Error Desugaring", "ត្រូវពិនិត្យមើល android/app/build.gradle.kts ត្រូវប្រាកដថាបានដាក់ isCoreLibraryDesugaringEnabled = true និង dependency desugar_jdk_libs:2.1.4"],
        ["Remote Config មិន update ភ្លាមៗ", "ត្រូវកំណត់ minimumFetchInterval = Duration.zero ក្នុង RemoteConfigSettings និង Publish changes លើ Firebase Console"],
        ["UI គាំងនៅ SplashScreen ពេលគ្មាន Internet", "ប្រើ try-catch ព័ទ្ធ Firebase.initializeApp() និងហៅ runApp() ភ្លាមៗដោយមិនបាច់ await remote services នៅ main thread"]
    ]
    format_table(faq_table, [2.5, 4.0], faq_headers, faq_rows)
    doc.add_paragraph().paragraph_format.space_after = Pt(16)

    # Footer note
    p_end = doc.add_paragraph("ឯកសារនេះត្រូវបានបង្កើតឡើងសម្រាប់ជាជំនួយដល់ក្រុមអភិវឌ្ឍន៍ប្រព័ន្ធវត្តមានបុគ្គលិក KHY-HENG Attendance System។")
    p_end.alignment = WD_ALIGN_PARAGRAPH.CENTER
    for r in p_end.runs:
        r.font.name = "Segoe UI"
        r.font.size = Pt(9)
        r.font.italic = True
        r.font.color.rgb = RGBColor(0x94, 0xA3, 0xB8)

    output_path = "d:/project/KHY-HENG_Attendance/Firebase_Configuration_Guide.docx"
    doc.save(output_path)
    print(f"Successfully generated: {output_path}")

if __name__ == "__main__":
    build_document()

# -*- coding: utf-8 -*-
import os
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import parse_xml
from docx.oxml.ns import nsdecls

def set_cell_background(cell, fill_color):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_color}"/>')
    tcPr.append(shd)

def set_cell_margins(cell, top=100, bottom=100, left=150, right=150):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = parse_xml(f'''
        <w:tcMar {nsdecls("w")}>
            <w:top w:w="{top}" w:type="dxa"/>
            <w:bottom w:w="{bottom}" w:type="dxa"/>
            <w:left w:w="{left}" w:type="dxa"/>
            <w:right w:w="{right}" w:type="dxa"/>
        </w:tcMar>
    ''')
    tcPr.append(tcMar)

def add_code_block(doc, code_text):
    tbl = doc.add_table(rows=1, cols=1)
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    tbl.autofit = False
    tbl.columns[0].width = Inches(6.5)
    
    cell = tbl.cell(0, 0)
    set_cell_background(cell, "F4F6F8")
    set_cell_margins(cell, top=120, bottom=120, left=180, right=180)
    
    tcPr = cell._tc.get_or_add_tcPr()
    borders = parse_xml(f'''
        <w:tcBorders {nsdecls("w")}>
            <w:top w:val="none"/>
            <w:left w:val="single" w:sz="24" w:space="0" w:color="0052CC"/>
            <w:bottom w:val="none"/>
            <w:right w:val="none"/>
        </w:tcBorders>
    ''')
    tcPr.append(borders)
    
    p = cell.paragraphs[0]
    p.paragraph_format.space_before = Pt(2)
    p.paragraph_format.space_after = Pt(2)
    p.paragraph_format.line_spacing = 1.15
    run = p.add_run(code_text)
    run.font.name = "Consolas"
    run.font.size = Pt(9.5)
    run.font.color.rgb = RGBColor(33, 37, 41)
    
    doc.add_paragraph().paragraph_format.space_after = Pt(4)

def add_callout(doc, title, text, box_type="info"):
    colors = {
        "info": {"bg": "EBF5FB", "border": "2980B9", "text_color": "1B4F72"},
        "warning": {"bg": "FEF9E7", "border": "F39C12", "text_color": "7D6608"},
        "success": {"bg": "EAFAF1", "border": "27AE60", "text_color": "145A32"}
    }
    cfg = colors.get(box_type, colors["info"])
    
    tbl = doc.add_table(rows=1, cols=1)
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    tbl.autofit = False
    tbl.columns[0].width = Inches(6.5)
    
    cell = tbl.cell(0, 0)
    set_cell_background(cell, cfg["bg"])
    set_cell_margins(cell, top=100, bottom=100, left=150, right=150)
    
    tcPr = cell._tc.get_or_add_tcPr()
    borders = parse_xml(f'''
        <w:tcBorders {nsdecls("w")}>
            <w:top w:val="none"/>
            <w:left w:val="single" w:sz="24" w:space="0" w:color="{cfg['border']}"/>
            <w:bottom w:val="none"/>
            <w:right w:val="none"/>
        </w:tcBorders>
    ''')
    tcPr.append(borders)
    
    p = cell.paragraphs[0]
    p.paragraph_format.space_before = Pt(2)
    p.paragraph_format.space_after = Pt(2)
    
    r_title = p.add_run(f"📌 {title}: ")
    r_title.bold = True
    r_title.font.name = "Khmer OS Siemreap"
    r_title.font.size = Pt(10)
    
    r_text = p.add_run(text)
    r_text.font.name = "Khmer OS Siemreap"
    r_text.font.size = Pt(10)
    
    doc.add_paragraph().paragraph_format.space_after = Pt(4)

def build_firebase_guide(output_path):
    doc = docx.Document()
    
    # Page Margins
    for section in doc.sections:
        section.top_margin = Inches(0.8)
        section.bottom_margin = Inches(0.8)
        section.left_margin = Inches(0.8)
        section.right_margin = Inches(0.8)

    # Styles Setup
    normal_style = doc.styles['Normal']
    normal_style.font.name = 'Khmer OS Siemreap'
    normal_style.font.size = Pt(10.5)
    normal_style.font.color.rgb = RGBColor(40, 40, 40)
    
    # Document Header / Title
    title_p = doc.add_paragraph()
    title_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    title_p.paragraph_format.space_before = Pt(0)
    title_p.paragraph_format.space_after = Pt(4)
    run_title = title_p.add_run("មគ្គុទ្ទេសក៍ការកំណត់រចនាសម្ព័ន្ធ FIREBASE ជំហានដោយជំហាន\n(Firebase Setup & Configuration Step-by-Step Guide)")
    run_title.font.name = 'Khmer OS Muol Light'
    run_title.font.size = Pt(15)
    run_title.bold = True
    run_title.font.color.rgb = RGBColor(0, 51, 102)

    # Subtitle / Info
    sub_p = doc.add_paragraph()
    sub_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    sub_p.paragraph_format.space_after = Pt(12)
    run_sub = sub_p.add_run("KHY HENG Attendance Management Mobile App (Flutter + Android / iOS / Web)")
    run_sub.font.name = 'Segoe UI'
    run_sub.font.size = Pt(10)
    run_sub.bold = True
    run_sub.font.color.rgb = RGBColor(0, 102, 153)

    # Divider line
    p_div = doc.add_paragraph()
    p_div.paragraph_format.space_after = Pt(10)
    p_div_run = p_div.add_run("―" * 58)
    p_div_run.font.color.rgb = RGBColor(200, 200, 200)
    p_div.alignment = WD_ALIGN_PARAGRAPH.CENTER

    # SECTION 1: OVERVIEW & ARCHITECTURE
    h1 = doc.add_heading(level=1)
    h1.paragraph_format.space_before = Pt(10)
    h1.paragraph_format.space_after = Pt(6)
    r = h1.add_run("១. សេចក្តីផ្តើម និងតួនាទីរបស់ Firebase ក្នុងកម្មវិធី (Overview & Role of Firebase)")
    r.font.name = "Khmer OS Muol Light"
    r.font.size = Pt(12)
    r.font.color.rgb = RGBColor(0, 51, 102)

    p = doc.add_paragraph(
        "នៅក្នុងកម្មវិធីទូរស័ព្ទ KHY HENG Attendance (Mobile App) សេវាកម្ម Firebase ដើរតួនាទីយ៉ាងសំខាន់ក្នុងការគ្រប់គ្រងការកំណត់ប្រព័ន្ធពីចម្ងាយ "
        "និងការផ្ញើសារជូនដំណឹងដោយពុំចាំបាច់ធ្វើការ Export/Build APK ថ្មីរាល់ពេលមានការផ្លាស់ប្តូរ IP ឬការកែលម្អប្រព័ន្ធឡើយ៖"
    )
    p.paragraph_format.space_after = Pt(6)

    # Overview Table
    tbl = doc.add_table(rows=5, cols=2)
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    tbl.autofit = False
    tbl.columns[0].width = Inches(2.2)
    tbl.columns[1].width = Inches(4.3)
    
    info_data = [
        ("1. Firebase Remote Config", "គ្រប់គ្រង Server IP/Host (server_host), Maintenance Mode និងមុខងារប្រព័ន្ធពី Cloud ភ្លាមៗ (Realtime)"),
        ("2. Cloud Messaging (FCM)", "ផ្ញើសារដំណឹង Push Notifications អំពីវត្តមាន ការសុំច្បាប់ និងការអនុម័តជូនបុគ្គលិក"),
        ("3. Firebase Analytics", "តាមដានចំនួនអ្នកប្រើប្រាស់ និងស្ថិតិនៃការដំណើរការកម្មវិធី"),
        ("4. Firebase Core Options", "កំណត់អត្តសញ្ញាណ Platform (Android, iOS, Web, Windows) តាមរយៈ firebase_options.dart")
    ]

    for i, (k, v) in enumerate(info_data):
        c0 = tbl.cell(i+1-1, 0)
        c1 = tbl.cell(i+1-1, 1)
        set_cell_background(c0, "EBF1F5" if i % 2 == 0 else "F4F6F8")
        set_cell_background(c1, "FFFFFF" if i % 2 == 0 else "F9F9F9")
        set_cell_margins(c0, top=50, bottom=50, left=90, right=90)
        set_cell_margins(c1, top=50, bottom=50, left=90, right=90)
        
        p0 = c0.paragraphs[0]
        p0.paragraph_format.space_before = Pt(2)
        p0.paragraph_format.space_after = Pt(2)
        r0 = p0.add_run(k)
        r0.bold = True
        r0.font.name = "Segoe UI"
        r0.font.size = Pt(9.5)
        
        p1 = c1.paragraphs[0]
        p1.paragraph_format.space_before = Pt(2)
        p1.paragraph_format.space_after = Pt(2)
        r1 = p1.add_run(v)
        r1.font.name = "Khmer OS Siemreap"
        r1.font.size = Pt(9.5)

    doc.add_paragraph().paragraph_format.space_after = Pt(6)

    add_callout(doc, "ពត៌មានអត្តសញ្ញាណកម្មវិធីបច្ចុប្បន្ន (Current App Identity)", 
                "• Package Name / Application ID: com.hrchomnan.mobile_app\n"
                "• Firebase Project ID ដើម: khy-heng\n"
                "• ទីតាំង File Config: mobile_app/android/app/google-services.json\n"
                "• ទីតាំង File Dart Options: mobile_app/lib/firebase_options.dart", "info")

    # SECTION 2: CREATE FIREBASE PROJECT
    h1 = doc.add_heading(level=1)
    h1.paragraph_format.space_before = Pt(14)
    h1.paragraph_format.space_after = Pt(6)
    r = h1.add_run("២. ជំហានទី ១៖ ការបង្កើត Firebase Project លើ Google Firebase Console")
    r.font.name = "Khmer OS Muol Light"
    r.font.size = Pt(12)
    r.font.color.rgb = RGBColor(0, 51, 102)

    p = doc.add_paragraph(
        "ប្រសិនបើលោកអ្នកចង់បង្កើត Firebase Project ថ្មីផ្ទាល់ខ្លួន ឬភ្ជាប់គណនីថ្មី សូមអនុវត្តតាមជំហានខាងក្រោម៖"
    )
    p.paragraph_format.space_after = Pt(4)

    steps_s1 = [
        "បើក Browser រួចចូលទៅកាន់គេហទំព័រផ្លូវការ៖ https://console.firebase.google.com/",
        "Sign In ដោយប្រើគណនី Google (Gmail) របស់ស្ថាប័ន ឬក្រុមហ៊ុន។",
        "ចុចប៊ូតុង 'Add project' (ឬ 'Create a project')។",
        "បញ្ចូលឈ្មោះ Project Name: ឧទាហរណ៍ 'khy-heng-attendance' រួចចុច 'Continue'។",
        "ត្រង់ផ្ទាំង Google Analytics: ជ្រើសរើស 'Enable Google Analytics for this project' រួចចុច 'Continue'។",
        "ជ្រើសរើស Google Analytics Account (Default Account for Firebase) រួចចុច 'Create project'។",
        "រង់ចាំពីរបីវិនាទី រហូតដល់បង្ហាញពាក្យ 'Your new project is ready' រួចចុច 'Continue' ដើម្បីចូលផ្ទាំងគ្រប់គ្រង Dashboard។"
    ]
    for s in steps_s1:
        p_item = doc.add_paragraph(style='List Bullet')
        p_item.paragraph_format.space_before = Pt(1)
        p_item.paragraph_format.space_after = Pt(2)
        r_item = p_item.add_run(s)
        r_item.font.name = "Khmer OS Siemreap"

    # SECTION 3: ADD ANDROID APP & GOOGLE-SERVICES.JSON
    h1 = doc.add_heading(level=1)
    h1.paragraph_format.space_before = Pt(14)
    h1.paragraph_format.space_after = Pt(6)
    r = h1.add_run("៣. ជំហានទី ២៖ ការបន្ថែម Android App និងទាញយក google-services.json")
    r.font.name = "Khmer OS Muol Light"
    r.font.size = Pt(12)
    r.font.color.rgb = RGBColor(0, 51, 102)

    p = doc.add_paragraph(
        "ដើម្បីភ្ជាប់កម្មវិធី Android Mobile App ទៅកាន់ Firebase Project សូមចុះឈ្មោះ App ដូចខាងក្រោម៖"
    )
    p.paragraph_format.space_after = Pt(4)

    steps_s2 = [
        "នៅលើទំព័រ Project Overview ចុចលើ Icon 'Android' ដើម្បី Add Firebase to your Android app។",
        "បំពេញ Android package name៖ com.hrchomnan.mobile_app (ចំណាំ៖ ត្រូវតែដូចគ្នាបេះបិទនឹង applicationId ក្នុង build.gradle.kts)",
        "បំពេញ App nickname៖ KHY HENG Attendance App",
        "Debug signing certificate SHA-1៖ (សូមមើលជំហានទី ៣ ខាងក្រោម ដើម្បីទាញយកលេខកូដ SHA-1)",
        "ចុចប៊ូតុង 'Register app'។",
        "ទាញយក File 'google-services.json' មកកាន់កុំព្យូទ័ររបស់អ្នក។",
        "ចម្លង (Copy) file 'google-services.json' ទៅដាក់ក្នុង Folder គម្រោង៖\n--> mobile_app/android/app/google-services.json"
    ]
    for s in steps_s2:
        p_item = doc.add_paragraph(style='List Bullet')
        p_item.paragraph_format.space_before = Pt(1)
        p_item.paragraph_format.space_after = Pt(2)
        r_item = p_item.add_run(s)
        r_item.font.name = "Khmer OS Siemreap"

    add_callout(doc, "ការផ្ទៀងផ្ទាត់ទីតាំង File google-services.json", 
                "ត្រូវប្រាកដថា file google-services.json ស្ថិតនៅខាងក្នុង folder 'mobile_app/android/app/' ដោយផ្ទាល់ "
                "(មិនមែនក្នុង root folder ឬ folder android ទេ)។ ប្រសិនបើដាក់ខុសកន្លែង នោះ Gradle នឹងបរាជ័យក្នុងការ Compile APK។", "warning")

    # SECTION 4: GET SHA-1 & SHA-256
    h1 = doc.add_heading(level=1)
    h1.paragraph_format.space_before = Pt(14)
    h1.paragraph_format.space_after = Pt(6)
    r = h1.add_run("៤. ជំហានទី ៣៖ របៀបទាញយកលេខកូដសម្ងាត់ SHA-1 និង SHA-256 Fingerprint")
    r.font.name = "Khmer OS Muol Light"
    r.font.size = Pt(12)
    r.font.color.rgb = RGBColor(0, 51, 102)

    p = doc.add_paragraph(
        "លេខកូដ SHA-1 និង SHA-256 គឺចាំបាច់សម្រាប់ការផ្ទៀងផ្ទាត់សុវត្ថិភាពរបស់ Google Services និង Firebase Messaging/Auth។ "
        "លោកអ្នកអាចទាញយកបានយ៉ាងងាយស្រួលតាមរយៈវិធីសាស្រ្តណាមួយខាងក្រោម៖"
    )
    p.paragraph_format.space_after = Pt(4)

    p = doc.add_paragraph()
    r = p.add_run("វិធីទី ១៖ ប្រើប្រាស់ Gradle Signing Report (ណែនាំ - ងាយស្រួលបំផុត):")
    r.bold = True
    r.font.name = "Khmer OS Siemreap"

    add_code_block(doc, """# បើក Terminal ឬ PowerShell រួចចូលទៅកាន់ folder android:
cd d:\\project\\KHY-HENG_Attendance\\mobile_app\\android

# ដំណើរការ Gradle signing report
.\\gradlew signingReport""")

    p = doc.add_paragraph(
        "បន្ទាប់ពីដំណើរការចប់ វានឹងបង្ហាញព័ត៌មាន Variant: debugAndroidTest / debug / release ដូចខាងក្រោម៖\n"
        "• SHA1: 31:C5:11:46:68:0B:66:36:... (ចម្លងលេខកូដនេះ)\n"
        "• SHA-256: A4:5F:... (ចម្លងលេខកូដនេះ)"
    )
    p.paragraph_format.space_after = Pt(4)

    p = doc.add_paragraph()
    r = p.add_run("វិធីទី ២៖ ប្រើប្រាស់ Keytool របស់ Java (ករណីគ្មាន Gradle):")
    r.bold = True
    r.font.name = "Khmer OS Siemreap"

    add_code_block(doc, """keytool -list -v -keystore "%USERPROFILE%\\.android\\debug.keystore" -alias androiddebugkey -storepass android -keypass android""")

    p = doc.add_paragraph()
    r = p.add_run("របៀបបញ្ចូល SHA Fingerprint ទៅក្នុង Firebase Console:")
    r.bold = True
    r.font.name = "Khmer OS Siemreap"

    steps_sha = [
        "ចូល Firebase Console -> ចុចលើរូប Gear (⚙️ Project Settings) នៅជ្រុងខាងឆ្វេងខាងលើ។",
        "រំកិលចុះក្រោមមកកាន់ផ្ទាំង 'Your apps' រួចជ្រើសរើស Android App (com.hrchomnan.mobile_app)។",
        "ត្រង់កន្លែង 'SHA certificate fingerprints' សូមចុចប៊ូតុង 'Add fingerprint'។",
        "Paste លេខកូដ SHA-1 រួចចុច Save។ បន្ទាប់មកចុច Add fingerprint ម្តងទៀតដើម្បី Paste SHA-256 រួចចុច Save។"
    ]
    for s in steps_sha:
        p_item = doc.add_paragraph(style='List Bullet')
        p_item.paragraph_format.space_before = Pt(1)
        p_item.paragraph_format.space_after = Pt(2)
        r_item = p_item.add_run(s)
        r_item.font.name = "Khmer OS Siemreap"

    # SECTION 5: FLUTTERFIRE CLI
    h1 = doc.add_heading(level=1)
    h1.paragraph_format.space_before = Pt(14)
    h1.paragraph_format.space_after = Pt(6)
    r = h1.add_run("៥. ជំហានទី ៤៖ ការ Configure កូដ Flutter ស្វ័យប្រវត្តិតាម FlutterFire CLI")
    r.font.name = "Khmer OS Muol Light"
    r.font.size = Pt(12)
    r.font.color.rgb = RGBColor(0, 51, 102)

    p = doc.add_paragraph(
        "FlutterFire CLI គឺជាឧបករណ៍ផ្លូវការរបស់ Firebase ដែលជួយបង្កើត file firebase_options.dart "
        "និងដំឡើង Configuration លើគ្រប់ Platform (Android, iOS, Web) ដោយស្វ័យប្រវត្តិ មិនបាច់សរសេរកូដដោយដៃឡើយ៖"
    )
    p.paragraph_format.space_after = Pt(4)

    add_code_block(doc, """# ១. ដំឡើង Firebase CLI តាមរយៈ Node.js npm (បើមិនទាន់មាន)
npm install -g firebase-tools

# ២. Login ចូលទៅកាន់គណនី Google Firebase របស់អ្នក
firebase login

# ៣. ដំឡើង FlutterFire CLI
dart pub global activate flutterfire_cli

# ៤. ចូលទៅកាន់ Folder mobile_app រួចដំណើរការ configure:
cd d:\\project\\KHY-HENG_Attendance\\mobile_app
flutterfire configure""")

    p = doc.add_paragraph(
        "អំឡុងពេលដំណើរការ 'flutterfire configure' ប្រព័ន្ធនឹងសួរសំណួរដូចខាងក្រោម៖\n"
        "១. Select a Firebase project: ជ្រើសរើស Project របស់អ្នក (ឧ. khy-heng)\n"
        "២. Which platforms should your configuration support?: ជ្រើសរើសយក android, ios, web (ចុច Spacebar ដើម្បី Tick រួចចុច Enter)\n"
        "៣. ប្រព័ន្ធនឹងបង្កើត file 'lib/firebase_options.dart' និង sync 'google-services.json' ជូនអ្នកដោយស្វ័យប្រវត្តិ។"
    )
    p.paragraph_format.space_after = Pt(4)

    # SECTION 6: REMOTE CONFIG PARAMETERS SETUP
    h1 = doc.add_heading(level=1)
    h1.paragraph_format.space_before = Pt(14)
    h1.paragraph_format.space_after = Pt(6)
    r = h1.add_run("៦. ជំហានទី ៥៖ ការកំណត់រចនាសម្ព័ន្ធ Firebase Remote Config (សំខាន់បំផុត)")
    r.font.name = "Khmer OS Muol Light"
    r.font.size = Pt(12)
    r.font.color.rgb = RGBColor(0, 51, 102)

    p = doc.add_paragraph(
        "នេះជាចំណុចពិសេស និងសំខាន់បំផុតរបស់ KHY HENG Attendance App! កូដរបស់ App ត្រូវបានរៀបចំរួចជាស្រេចនៅក្នុង "
        "RemoteConfigService ដើម្បីទាញយក IP Server និង Status ពីចម្ងាយ។ ដើម្បីកំណត់ Parameters សូមអនុវត្តដូចខាងក្រោម៖"
    )
    p.paragraph_format.space_after = Pt(4)

    steps_rc = [
        "ចូលទៅកាន់ Firebase Console (https://console.firebase.google.com/) រួចជ្រើសរើស Project របស់អ្នក។",
        "នៅ Menu ខាងឆ្វេង សូមចុចលើ 'Run' (ឬ 'Build') -> រួចជ្រើសរើសយក 'Remote Config'។",
        "ប្រសិនបើទើបប្រើដំបូង សូមចុចប៊ូតុង 'Create configuration'។ ប្រសិនបើធ្លាប់មាន សូមចុច 'Add parameter'។",
        "បង្កើត Parameters តាមតារាងស្តង់ដារបស់ App ដូចខាងក្រោម៖"
    ]
    for s in steps_rc:
        p_item = doc.add_paragraph(style='List Bullet')
        p_item.paragraph_format.space_before = Pt(1)
        p_item.paragraph_format.space_after = Pt(2)
        r_item = p_item.add_run(s)
        r_item.font.name = "Khmer OS Siemreap"

    # Remote Config Parameters Table
    rc_tbl = doc.add_table(rows=6, cols=4)
    rc_tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    rc_tbl.autofit = False
    rc_tbl.columns[0].width = Inches(1.8)
    rc_tbl.columns[1].width = Inches(0.9)
    rc_tbl.columns[2].width = Inches(1.5)
    rc_tbl.columns[3].width = Inches(2.3)

    rc_headers = ["Parameter Key", "Data Type", "Default Value", "អត្ថន័យ និងការប្រើប្រាស់"]
    for j, h in enumerate(rc_headers):
        c = rc_tbl.cell(0, j)
        set_cell_background(c, "003366")
        set_cell_margins(c, top=60, bottom=60, left=80, right=80)
        p = c.paragraphs[0]
        r = p.add_run(h)
        r.bold = True
        r.font.name = "Khmer OS Siemreap"
        r.font.size = Pt(9)
        r.font.color.rgb = RGBColor(255, 255, 255)

    rc_rows = [
        ("server_host", "String", "100.56.149.110 (ឬ IP Server)", "កំណត់ IP ឬ Domain របស់ Server Backend។ កែប្រែភ្លាម App ប្តូរគោលដៅ API ភ្លាម!"),
        ("is_maintenance_mode", "Boolean", "false", "បើដាក់ true កម្មវិធីនឹង Lock ហើយបង្ហាញផ្ទាំង Maintenance Screen ភ្លាម"),
        ("maintenance_message", "String", "ប្រព័ន្ធកំពុងដំណើរការកែលម្អ...", "សារជូនដំណឹងពេលប្រព័ន្ធកំពុងបិទកែលម្អ"),
        ("min_app_version", "String", "1.0.0", "កំណែទម្រង់អប្បបរមាដែលអនុញ្ញាតឱ្យប្រើប្រាស់"),
        ("enable_face_recognition", "Boolean", "true", "បើក ឬបិទមុខងារស្កេនផ្ទៃមុខសម្រាប់កត់ត្រាវត្តមាន")
    ]

    for i, row in enumerate(rc_rows):
        for j, val in enumerate(row):
            c = rc_tbl.cell(i+1, j)
            set_cell_background(c, "FFFFFF" if i % 2 == 0 else "F4F6F8")
            set_cell_margins(c, top=50, bottom=50, left=80, right=80)
            p = c.paragraphs[0]
            p.paragraph_format.space_before = Pt(2)
            p.paragraph_format.space_after = Pt(2)
            r = p.add_run(val)
            r.font.name = "Segoe UI" if j < 3 else "Khmer OS Siemreap"
            r.font.size = Pt(8.5)
            if j == 0:
                r.bold = True

    doc.add_paragraph().paragraph_format.space_after = Pt(6)

    add_callout(doc, "ចំណុចសំខាន់បន្ទាប់ពីបន្ថែម Parameter (Publish Changes)", 
                "បន្ទាប់ពីលោកអ្នកបានបញ្ចូល ឬកែប្រែ Parameter ណាមួយរួច សូមកុំភ្លេចចុចប៊ូតុងពណ៌ខៀវ 'Publish changes' "
                "នៅជ្រុងខាងស្តាំខាងលើជានិច្ច! ប្រសិនបើមិនចុច Publish ទេ ការកែប្រែនឹងមិនត្រូវបានបញ្ជូនទៅកាន់ទូរស័ព្ទឡើយ។", "warning")

    # SECTION 7: FCM PUSH NOTIFICATIONS
    h1 = doc.add_heading(level=1)
    h1.paragraph_format.space_before = Pt(14)
    h1.paragraph_format.space_after = Pt(6)
    r = h1.add_run("៧. ជំហានទី ៦៖ ការរៀបចំ Firebase Cloud Messaging (FCM Push Notifications)")
    r.font.name = "Khmer OS Muol Light"
    r.font.size = Pt(12)
    r.font.color.rgb = RGBColor(0, 51, 102)

    p = doc.add_paragraph(
        "ដើម្បីឱ្យ Backend Spring Boot អាច Push Notification មកកាន់ទូរស័ព្ទរបស់បុគ្គលិកបានដោយស្វ័យប្រវត្តិនោះ លោកអ្នកត្រូវទាញយក Service Account Key៖"
    )
    p.paragraph_format.space_after = Pt(4)

    steps_fcm = [
        "ចូល Firebase Console -> ចុចលើរូប Gear (⚙️ Project Settings)។",
        "ជ្រើសរើសផ្ទាំង Tab 'Service accounts'។",
        "ជ្រើសរើសយក 'Firebase Admin SDK' រួចចុចប៊ូតុង 'Generate new private key'។",
        "ផ្ទាំងបញ្ជាក់នឹងលោតឡើង សូមចុច 'Generate key' ដើម្បីទាញយក file JSON (ឧ. khy-heng-firebase-adminsdk-xxx.json)។",
        "រក្សាទុក file នេះទុកសម្រាប់ configure ក្នុង backend Spring Boot (application.yml) សម្រាប់មុខងារផ្ញើសារ Push Notification ជូនដំណឹងវត្តមាន។"
    ]
    for s in steps_fcm:
        p_item = doc.add_paragraph(style='List Bullet')
        p_item.paragraph_format.space_before = Pt(1)
        p_item.paragraph_format.space_after = Pt(2)
        r_item = p_item.add_run(s)
        r_item.font.name = "Khmer OS Siemreap"

    # SECTION 8: BUILD AND VERIFY APK
    h1 = doc.add_heading(level=1)
    h1.paragraph_format.space_before = Pt(14)
    h1.paragraph_format.space_after = Pt(6)
    r = h1.add_run("៨. ជំហានទី ៧៖ របៀប Compile និង Export Release APK ក្រោយពេល Config រួច")
    r.font.name = "Khmer OS Muol Light"
    r.font.size = Pt(12)
    r.font.color.rgb = RGBColor(0, 51, 102)

    p = doc.add_paragraph(
        "បន្ទាប់ពីបានរៀបចំ file google-services.json និង firebase_options.dart ត្រឹមត្រូវហើយ លោកអ្នកអាច Export APK ផ្លូវការបានដោយដំណើរការ Command៖"
    )
    p.paragraph_format.space_after = Pt(4)

    add_code_block(doc, """# ១. ចូលទៅកាន់ Folder mobile_app
cd d:\\project\\KHY-HENG_Attendance\\mobile_app

# ២. សម្អាត Cache ចាស់ៗ (Optional)
flutter clean
flutter pub get

# ៣. បង្កើត Release APK
flutter build apk --release""")

    p = doc.add_paragraph(
        "ទីតាំងដែល APK នឹងត្រូវបានបង្កើតឡើងគឺ៖\n"
        "• ផ្លូវការ: mobile_app/build/app/outputs/flutter-apk/app-release.apk\n"
        "• Root Folder ងាយស្រួលរក: KHY-HENG-Attendance.apk"
    )
    p.paragraph_format.space_after = Pt(4)

    # SECTION 9: TROUBLESHOOTING & FAQS
    h1 = doc.add_heading(level=1)
    h1.paragraph_format.space_before = Pt(14)
    h1.paragraph_format.space_after = Pt(6)
    r = h1.add_run("៩. សំណួរញឹកញាប់ និងការដោះស្រាយបញ្ហា (Troubleshooting & FAQs)")
    r.font.name = "Khmer OS Muol Light"
    r.font.size = Pt(12)
    r.font.color.rgb = RGBColor(0, 51, 102)

    faqs = [
        ("សំណួរ: ហេតុអ្វីបានជា App បង្ហាញ Error 'File google-services.json is missing' ពេល build?",
         "ចម្លើយ: បញ្ហានេះបណ្តាលមកពីមិនទាន់បានដាក់ file google-services.json ក្នុង folder mobile_app/android/app/។ សូមទាញយកពី Firebase Console រួចដាក់ចូលទីតាំងនេះ។"),
        ("សំណួរ: ហេតុអ្វីកែ server_host លើ Firebase Remote Config ហើយ App នៅទូរស័ព្ទមិនទាន់ប្តូរ?",
         "ចម្លើយ: ១) ពិនិត្យមើលថាតើបានចុចប៊ូតុង 'Publish changes' លើ Firebase Console ហើយឬនៅ? ២) កម្មវិធីទូរស័ព្ទមាន Realtime Listener ប៉ុន្តែប្រសិនបើគ្មាន Internet កម្មវិធីនឹងប្រើ Default Host បម្រុងទុករហូតដល់មាន Internet ឡើងវិញ។"),
        ("សំណួរ: បើចង់ប្តូរ Server IP ទៅថ្ងៃក្រោយ តើត្រូវ Build APK ថ្មីចែកជូនបុគ្គលិកដែរឬទេ?",
         "ចម្លើយ: មិនបាច់ទេ! នេះជាអត្ថប្រយោជន៍ចម្បងនៃ Remote Config។ លោកអ្នកគ្រាន់តែចូល Firebase Console -> Remote Config -> កែតម្លៃ server_host ទៅកាន់ IP ឬ Domain ថ្មី រួចចុច Publish ជាការស្រេច។ App ទាំងអស់នឹងភ្ជាប់ទៅ IP ថ្មីដោយស្វ័យប្រវត្តិ។")
    ]

    for q, a in faqs:
        p_q = doc.add_paragraph()
        p_q.paragraph_format.space_before = Pt(4)
        p_q.paragraph_format.space_after = Pt(2)
        r_q = p_q.add_run(q)
        r_q.bold = True
        r_q.font.name = "Khmer OS Siemreap"
        r_q.font.color.rgb = RGBColor(0, 51, 102)

        p_a = doc.add_paragraph()
        p_a.paragraph_format.space_before = Pt(1)
        p_a.paragraph_format.space_after = Pt(6)
        r_a = p_a.add_run(a)
        r_a.font.name = "Khmer OS Siemreap"

    # Footer note
    p_foot = doc.add_paragraph()
    p_foot.paragraph_format.space_before = Pt(20)
    p_foot.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r_foot = p_foot.add_run("― រៀបចំដោយក្រុមការងារបច្ចេកទេស KHY HENG Attendance Management System ―")
    r_foot.font.name = "Khmer OS Siemreap"
    r_foot.font.size = Pt(9)
    r_foot.font.italic = True
    r_foot.font.color.rgb = RGBColor(120, 120, 120)

    # Save Document
    doc.save(output_path)
    print(f"Document successfully created at: {output_path}")

if __name__ == "__main__":
    out_dir = r"d:\project\KHY-HENG_Attendance\docs"
    os.makedirs(out_dir, exist_ok=True)
    out_file = os.path.join(out_dir, "Firebase_Configuration_Step_by_Step_Guide.docx")
    build_firebase_guide(out_file)

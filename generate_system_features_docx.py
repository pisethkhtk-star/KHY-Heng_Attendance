import os
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import parse_xml, OxmlElement
from docx.oxml.ns import nsdecls, qn

def set_cell_background(cell, fill_color):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_color}"/>')
    tcPr.append(shd)

def set_cell_margins(cell, top=120, bottom=120, left=160, right=160):
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

def set_table_borders(table, color="D3D3D3", sz="4", val="single"):
    tblPr = table._tbl.tblPr
    borders = parse_xml(f'''
        <w:tblBorders {nsdecls("w")}>
            <w:top w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>
            <w:bottom w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>
            <w:left w:val="none"/>
            <w:right w:val="none"/>
            <w:insideH w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>
            <w:insideV w:val="none"/>
        </w:tblBorders>
    ''')
    tblPr.append(borders)

def add_header_styled(doc, text, level=1):
    h = doc.add_heading(level=level)
    h.paragraph_format.keep_with_next = True
    
    if level == 1:
        h.paragraph_format.space_before = Pt(16)
        h.paragraph_format.space_after = Pt(6)
        r = h.add_run(text)
        r.font.name = "Khmer OS Muol Light"
        r.font.size = Pt(13)
        r.bold = True
        r.font.color.rgb = RGBColor(0, 51, 102) # Deep Navy
    elif level == 2:
        h.paragraph_format.space_before = Pt(12)
        h.paragraph_format.space_after = Pt(4)
        r = h.add_run(text)
        r.font.name = "Khmer OS Siemreap"
        r.font.size = Pt(11.5)
        r.bold = True
        r.font.color.rgb = RGBColor(0, 102, 153) # Teal Blue
    elif level == 3:
        h.paragraph_format.space_before = Pt(8)
        h.paragraph_format.space_after = Pt(3)
        r = h.add_run(text)
        r.font.name = "Khmer OS Siemreap"
        r.font.size = Pt(10.5)
        r.bold = True
        r.font.color.rgb = RGBColor(44, 62, 80)
    return h

def add_callout(doc, title, text, box_type="info"):
    colors = {
        "info": {"bg": "EBF5FB", "border": "2980B9", "text_color": "1B4F72"},
        "warning": {"bg": "FEF9E7", "border": "F39C12", "text_color": "7D6608"},
        "success": {"bg": "EAFAF1", "border": "27AE60", "text_color": "145A32"},
        "purple": {"bg": "F4ECF7", "border": "8E44AD", "text_color": "512E5F"}
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
    p.paragraph_format.line_spacing = 1.15
    
    r_title = p.add_run(f"💡 {title}\n")
    r_title.bold = True
    r_title.font.name = "Khmer OS Siemreap"
    r_title.font.size = Pt(10)
    r_title.font.color.rgb = RGBColor(0, 51, 102)
    
    r_text = p.add_run(text)
    r_text.font.name = "Khmer OS Siemreap"
    r_text.font.size = Pt(9.5)
    
    doc.add_paragraph().paragraph_format.space_after = Pt(4)

def add_feature_table(doc, headers, data, col_widths=None):
    tbl = doc.add_table(rows=len(data) + 1, cols=len(headers))
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    tbl.autofit = False
    set_table_borders(tbl, color="CBD5E1")
    
    if col_widths:
        for idx, width in enumerate(col_widths):
            tbl.columns[idx].width = Inches(width)
            
    # Header row
    hdr_cells = tbl.rows[0].cells
    for i, title in enumerate(headers):
        hdr_cells[i].text = ""
        p = hdr_cells[i].paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.space_before = Pt(4)
        p.paragraph_format.space_after = Pt(4)
        run = p.add_run(title)
        run.bold = True
        run.font.name = "Khmer OS Siemreap"
        run.font.size = Pt(9.5)
        run.font.color.rgb = RGBColor(255, 255, 255)
        set_cell_background(hdr_cells[i], "004080")
        set_cell_margins(hdr_cells[i], top=90, bottom=90, left=100, right=100)
        
    # Data rows
    for r_idx, row_data in enumerate(data):
        row = tbl.rows[r_idx + 1]
        bg_col = "F8FAFC" if r_idx % 2 == 1 else "FFFFFF"
        for c_idx, val in enumerate(row_data):
            cell = row.cells[c_idx]
            cell.text = ""
            set_cell_background(cell, bg_col)
            set_cell_margins(cell, top=70, bottom=70, left=100, right=100)
            p = cell.paragraphs[0]
            p.paragraph_format.space_before = Pt(2)
            p.paragraph_format.space_after = Pt(2)
            p.paragraph_format.line_spacing = 1.15
            run = p.add_run(val)
            run.font.name = "Khmer OS Siemreap"
            run.font.size = Pt(9.0)
            if c_idx == 0:
                run.bold = True
                p.alignment = WD_ALIGN_PARAGRAPH.LEFT
            elif c_idx == 1 and len(row_data) > 3:
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                
    doc.add_paragraph().paragraph_format.space_after = Pt(6)

def build_document(file_path):
    doc = docx.Document()
    
    # Setup page margins
    for s in doc.sections:
        s.top_margin = Inches(0.8)
        s.bottom_margin = Inches(0.8)
        s.left_margin = Inches(0.8)
        s.right_margin = Inches(0.8)
        
    normal_style = doc.styles['Normal']
    normal_style.font.name = 'Khmer OS Siemreap'
    normal_style.font.size = Pt(10)
    normal_style.font.color.rgb = RGBColor(40, 40, 40)
    
    # ----------------------------------------------------
    # COVER / HEADER
    # ----------------------------------------------------
    title_p = doc.add_paragraph()
    title_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    title_p.paragraph_format.space_before = Pt(12)
    title_p.paragraph_format.space_after = Pt(4)
    run_main_title = title_p.add_run("ឯកសារពិពណ៌នាមុខងារប្រព័ន្ធពេញលេញ\n(FULL SYSTEM FEATURES SPECIFICATION)")
    run_main_title.font.name = "Khmer OS Muol Light"
    run_main_title.font.size = Pt(16)
    run_main_title.bold = True
    run_main_title.font.color.rgb = RGBColor(0, 51, 102)
    
    sub_p = doc.add_paragraph()
    sub_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    sub_p.paragraph_format.space_after = Pt(12)
    run_sub = sub_p.add_run("ប្រព័ន្ធគ្រប់គ្រងវត្តមាន ច្បាប់សម្រាក និងប្រាក់បៀវត្សរ៍ (KHY-HENG / HR Chomnan)\nWebsite Portal (React) & Mobile Application (Flutter)")
    run_sub.font.name = "Khmer OS Siemreap"
    run_sub.font.size = Pt(11)
    run_sub.bold = True
    run_sub.font.color.rgb = RGBColor(0, 102, 153)
    
    # Meta table
    meta_tbl = doc.add_table(rows=4, cols=2)
    meta_tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    meta_tbl.columns[0].width = Inches(2.2)
    meta_tbl.columns[1].width = Inches(4.3)
    set_table_borders(meta_tbl, color="B0C4DE")
    
    meta_info = [
        ("ឈ្មោះប្រព័ន្ធ (System Name)", "KHY-HENG Attendance, Leave & Payroll Management System"),
        ("សមាសភាគប្រព័ន្ធ (Components)", "1. Website Portal (React Vite)\n2. Mobile Application (Flutter iOS/Android)\n3. Backend RESTful API (Spring Boot 3 + Java 21)\n4. Database (PostgreSQL 16)"),
        ("បច្ចេកវិទ្យាឆ្លាតវៃ (Smart Tech)", "AI Face Recognition Descriptors, QR Code Badges, GPS Geofencing, Telegram Bot, Firebase Cloud Messaging (FCM)"),
        ("កាលបរិច្ឆេទ & កំណែ (Date & Version)", "Version 2.0 (ខែមីនា ឆ្នាំ២០២៦) | សម្រាប់រដ្ឋបាល និងបុគ្គលិក")
    ]
    for idx, (k, v) in enumerate(meta_info):
        c0 = meta_tbl.cell(idx, 0)
        c1 = meta_tbl.cell(idx, 1)
        set_cell_background(c0, "F0F4F8")
        set_cell_background(c1, "FFFFFF")
        set_cell_margins(c0, top=60, bottom=60, left=100, right=100)
        set_cell_margins(c1, top=60, bottom=60, left=100, right=100)
        
        p0 = c0.paragraphs[0]
        r0 = p0.add_run(k)
        r0.bold = True
        r0.font.name = "Khmer OS Siemreap"
        r0.font.size = Pt(9.5)
        
        p1 = c1.paragraphs[0]
        r1 = p1.add_run(v)
        r1.font.name = "Khmer OS Siemreap"
        r1.font.size = Pt(9.5)
        
    doc.add_paragraph().paragraph_format.space_after = Pt(12)
    
    # Divider
    div_p = doc.add_paragraph()
    div_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    div_p.paragraph_format.space_after = Pt(14)
    r_div = div_p.add_run("―" * 58)
    r_div.font.color.rgb = RGBColor(180, 190, 205)

    # ----------------------------------------------------
    # SECTION 1: SYSTEM ARCHITECTURE & ROLES
    # ----------------------------------------------------
    add_header_styled(doc, "ផ្នែកទី ១៖ ស្ថាបត្យកម្មប្រព័ន្ធ និងតួនាទីអ្នកប្រើប្រាស់ (System Architecture & User Roles)", level=1)
    
    p = doc.add_paragraph()
    p.add_run("ប្រព័ន្ធ KHY-HENG Attendance ត្រូវបានរចនាឡើងជាលក្ខណៈ Enterprise-grade Fullstack Ecosystem ដើម្បីធានាបាននូវភាពសុក្រឹត តម្លាភាព និងភាពងាយស្រួលក្នុងការគ្រប់គ្រងវត្តមានបុគ្គលិក ច្បាប់ឈប់សម្រាក និងការគណនាប្រាក់បៀវត្សរ៍ ដោយបែងចែកជាពីរផ្ទាំងប្រើប្រាស់ចម្បង៖ Website (Admin/HR/Manager Dashboard) និង Mobile App (Employee & Manager Mobile Access)។")
    p.paragraph_format.space_after = Pt(6)

    role_headers = ["តួនាទី (Role)", "បរិយាកាស (Platform)", "សិទ្ធិ និងដែនកំណត់ (Permissions & Scope)"]
    role_data = [
        ["Super Admin / IT Admin", "Website", "គ្រប់គ្រងប្រព័ន្ធទាំងមូល, កំណត់សិទ្ធិ (RBAC), បង្កើតគណនី, កំណត់ Kiosk Geofencing, Telegram Bot, FCM Notifications"],
        ["HR Manager", "Website", "គ្រប់គ្រងទិន្នន័យបុគ្គលិក, ចុះឈ្មោះ Face Scan / QR Badge, គ្រប់គ្រងច្បាប់, កំណត់ប្រាក់បៀវត្សរ៍, រត់ Payroll, ទាញរបាយការណ៍ Excel/PDF"],
        ["Department Manager / Head", "Website & Mobile App", "ពិនិត្យវត្តមានបុគ្គលិកក្រោមឱវាទ, អនុម័ត ឬបដិសេធសំណើច្បាប់សម្រាក (Leave Requests), អនុម័តម៉ោងបន្ថែម (Overtime) លើទូរស័ព្ទផ្ទាល់"],
        ["Employee (បុគ្គលិកទូទៅ)", "Mobile App & Kiosk", "កត់ត្រាវត្តមាន (Check In/Out) តាមទូរស័ព្ទដោយប្រើ GPS Geofencing ឬតាម Kiosk (Face/QR), មើលប្រវត្តិវត្តមាន, ដាក់ពាក្យសុំច្បាប់, ស្នើសុំ OT, មើលកាតបុគ្គលិក"],
        ["Kiosk Terminal", "Web Tablet / Screen", "ដាក់នៅមាត់ទ្វារក្រុមហ៊ុន សម្រាប់បុគ្គលិកស្កេនមុខ (Face Recognition AI) ឬស្កេនកាត QR Code ពេលចេញ-ចូល"]
    ]
    add_feature_table(doc, role_headers, role_data, [1.6, 1.3, 3.6])

    # ----------------------------------------------------
    # SECTION 2: WEBSITE PORTAL FEATURES
    # ----------------------------------------------------
    add_header_styled(doc, "ផ្នែកទី ២៖ មុខងារលម្អិតទាំងអស់នៃ WEBSITE PORTAL (Admin & HR Portal)", level=1)
    
    p = doc.add_paragraph()
    p.add_run("Website Portal ត្រូវបានបង្កើតឡើងដោយប្រើប្រាស់បច្ចេកវិទ្យា React (Vite) + TailwindCSS ដែលមានល្បឿនលឿន និង Interface ទំនើប ងាយស្រួលប្រើប្រាស់។ ខាងក្រោមនេះជាមុខងារតាមផ្នែកនីមួយៗនៃ Website៖")
    p.paragraph_format.space_after = Pt(6)

    # 2.1 Dashboard & Analytics
    add_header_styled(doc, "២.១ ផ្ទាំងគ្រប់គ្រង និងស្ថិតិវត្តមាន (Dashboard & Real-time Analytics)", level=2)
    dash_headers = ["មុខងារ (Feature)", "ការពណ៌នាលម្អិត (Detailed Description)"]
    dash_data = [
        ["Real-time Summary Cards", "បង្ហាញស្ថិតិបច្ចុប្បន្នភាពប្រចាំថ្ងៃភ្លាមៗ៖ ចំនួនបុគ្គលិកសរុប, បុគ្គលិកមកធ្វើការ (Present), មកយឺត (Late), អវត្តមាន (Absent), កំពុងសុំច្បាប់ (On Leave) និងមិនទាន់ Check-out (Incomplete)"],
        ["Attendance Presence Rate Chart", "ក្រាហ្វិកបង្ហាញភាគរយវត្តមានសរុបធៀបនឹងថ្ងៃមុនៗ ជួយឱ្យអ្នកគ្រប់គ្រងមើលឃើញនិន្នាការវត្តមានភ្លាមៗ"],
        ["Department Breakdown Chart", "ក្រាហ្វិកបែងចែកអត្រាវត្តមានតាមផ្នែកនីមួយៗ (IT, HR, Marketing, Operations, etc.)"],
        ["Recent Punch Activity Stream", "តារាងរត់បង្ហាញទិន្នន័យបុគ្គលិកដែលទើបតែ Check In ឬ Check Out ក្នុងពេលជាក់ស្តែង (Live Stream) រួមទាំងរូបថត និងម៉ោងកំណត់"]
    ]
    add_feature_table(doc, dash_headers, dash_data, [2.2, 4.3])

    # 2.2 Attendance Tracking & Management
    add_header_styled(doc, "២.២ ការគ្រប់គ្រង និងត្រួតពិនិត្យវត្តមាន (Attendance Management Modules)", level=2)
    att_headers = ["ទំព័រ/មុខងារ", "កូដប្រភព (Source)", "មុខងារស្នូល និងលទ្ធភាពធ្វើការ (Core Functions)"]
    att_data = [
        ["Daily Attendance Master", "Attendance.jsx", "តារាងមេគ្រប់គ្រងវត្តមានប្រចាំថ្ងៃ និងតាមខែ, Filter តាមកាលបរិច្ឆេទ ផ្នែក និងឈ្មោះ, មើលម៉ោងចូល/ចេញ ទីតាំង GPS និងប៊ូតុងកែសម្រួលដោយដៃ"],
        ["Late Attendance Tracker", "AttendanceLate.jsx", "គ្រប់គ្រងបុគ្គលិកដែលមកយឺតម៉ោង, គណនាចំនួននាទីយឺតដោយស្វ័យប្រវត្តិធៀបនឹង Shift, កត់ត្រាមូលហេតុយឺត និងការអនុញ្ញាតលើកលែង"],
        ["Early In Tracker", "AttendanceEarlyIn.jsx", "តាមដានបុគ្គលិកដែលមកមុនម៉ោងធ្វើការ ដើម្បីវាយតម្លៃការឧស្សាហ៍ព្យាយាម ឬរៀបចំគណនាម៉ោងមុនវេន"],
        ["Early Out Tracker", "AttendanceEarlyOut.jsx", "កត់ត្រាបុគ្គលិកដែលចេញមុនម៉ោងកំណត់ (Early Departure) រួមទាំងចំនួននាទី និងហេតុផល"],
        ["Incomplete Punches", "AttendanceIncomplete.jsx", "គ្រប់គ្រងបុគ្គលិកដែលភ្លេច Check-Out (មានតែ In គ្មាន Out), ផ្តល់សិទ្ធិឱ្យ HR បញ្ជាក់ម៉ោងជាក់ស្តែង និងបំពេញទិន្នន័យឱ្យបានពេញលេញ"],
        ["Attendance Slip / Timesheet", "AttendanceSlip.jsx", "បង្កើត និងទាញយកប័ណ្ណសង្ខេបវត្តមានប្រចាំខែ (Employee Attendance Slip/Card) សម្រាប់បុគ្គលិកម្នាក់ៗ បង្ហាញវត្តមានពេញមួយខែដើម្បីចុះហត្ថលេខា"]
    ]
    add_feature_table(doc, att_headers, att_data, [1.8, 1.5, 3.2])

    # 2.3 Leave Management System
    add_header_styled(doc, "២.៣ ប្រព័ន្ធគ្រប់គ្រងច្បាប់សម្រាក (Leave Management System)", level=2)
    leave_headers = ["ទំព័រ/មុខងារ", "កូដប្រភព (Source)", "មុខងារស្នូល (Core Capabilities)"]
    leave_data = [
        ["Leave Requests Management", "Leaves.jsx", "បញ្ជីពាក្យសុំច្បាប់ទាំងអស់របស់បុគ្គលិក, ត្រួតពិនិត្យស្ថានភាព (Pending, Approved, Rejected), មើលឯកសារភ្ជាប់ (លិខិតពេទ្យ/ឯកសារបញ្ជាក់)"],
        ["Leave Types Configuration", "LeaveTypes.jsx", "កំណត់ប្រភេទច្បាប់ផ្សេងៗ (Annual Leave, Sick Leave, Maternity Leave, Special Leave, Unpaid Leave), កំណត់ថាតើជាច្បាប់មានប្រាក់ខែ (Paid) ឬអត់ (Unpaid)"],
        ["Customized Leave Allowances", "LeaveAllowances.jsx", "កំណត់កូតាចំនួនថ្ងៃច្បាប់សម្រាកប្រចាំឆ្នាំសម្រាប់បុគ្គលិកម្នាក់ៗ (Leave Entitlements/Balances) និងតាមដានថ្ងៃនៅសល់"],
        ["Multi-tier Leave Approval", "ApprovalManage.jsx", "ប្រព័ន្ធលំហូរអនុម័តច្បាប់ (Approval Workflow)៖ ប្រធានផ្នែកអនុម័តជំហានទី១ និង HR អនុម័តជាស្ថាពរ"],
        ["Leave Analytics & Reports", "LeaveReport.jsx", "របាយការណ៍សង្ខេបការឈប់សម្រាកប្រចាំខែ/ឆ្នាំ តាមផ្នែក និងតាមប្រភេទច្បាប់ ទាញជា Excel/PDF"]
    ]
    add_feature_table(doc, leave_headers, leave_data, [1.8, 1.5, 3.2])

    # 2.4 Overtime Management
    add_header_styled(doc, "២.៤ ការគ្រប់គ្រងការងារក្រៅម៉ោង (Overtime Management - OT)", level=2)
    ot_headers = ["មុខងារ", "កូដប្រភព", "ការពណ៌នា (Description)"]
    ot_data = [
        ["OT Submission & Pre-approval", "Overtime.jsx", "ការស្នើសុំម៉ោងបន្ថែមមុនពេលធ្វើការ (Pre-approved OT) ដោយបញ្ជាក់ពីគោលបំណង គម្រោង និងម៉ោងគ្រោងទុក"],
        ["Automatic OT Multiplier", "Backend Rules", "គណនាអត្រាគុណប្រាក់ម៉ោងបន្ថែម៖ ថ្ងៃធម្មតា (1.5x), ថ្ងៃសម្រាកចុងសប្តាហ៍ (2.0x), ថ្ងៃបុណ្យជាតិ (2.0x ឬ 3.0x)"],
        ["OT Verification & Integration", "Payroll Link", "ផ្ទៀងផ្ទាត់ម៉ោង OT ពិតប្រាកដតាមរយៈម៉ោង Check-Out និងបញ្ចូលទិន្នន័យស្វ័យប្រវត្តិចូលទៅកាន់ប្រព័ន្ធ Payroll"]
    ]
    add_feature_table(doc, ot_headers, ot_data, [1.8, 1.3, 3.4])

    # 2.5 Payroll System
    add_header_styled(doc, "២.៥ ប្រព័ន្ធគ្រប់គ្រង និងគណនាប្រាក់បៀវត្សរ៍ (Payroll System)", level=2)
    pay_headers = ["ទំព័រ/មុខងារ", "កូដប្រភព (Source)", "មុខងារស្នូល (Core Functions)"]
    pay_data = [
        ["Salary Structure Setup", "PayrollSalaryStructure.jsx", "កំណត់រចនាសម្ព័ន្ធប្រាក់ខែបុគ្គលិក៖ ប្រាក់ខែគោល (Base Salary), ប្រាក់ឧបត្ថម្ភធ្វើដំណើរ, ថ្លៃបាយ, ប្រាក់លើកទឹកចិត្ត (Incentives/Bonus)"],
        ["Automated Payroll Run", "PayrollRun.jsx", "ប្រព័ន្ធរត់ប្រាក់ខែស្វ័យប្រវត្តិតាមខែ ដោយបូកប្រាក់ខែគោល + ប្រាក់ OT - កាត់ប្រាក់មកយឺត - កាត់ប្រាក់អវត្តមាន/ច្បាប់គ្មានប្រាក់ខែ"],
        ["Payslips Generation", "PayrollPayslips.jsx", "បង្កើតវិក្កយបត្របើកប្រាក់បៀវត្សរ៍ (Payslip) ជាលក្ខណៈឌីជីថល និងទម្រង់ PDF សម្រាប់ព្រីនចែកជូនបុគ្គលិក ឬមើលលើ App"],
        ["Payroll Settings & Deductions", "PayrollSettings.jsx", "កំណត់រូបិយប័ណ្ណ (KHR / USD), អត្រាប្តូរប្រាក់, ការកាត់ពន្ធលើប្រាក់បៀវត្សរ៍ និងភាគទាន ប.ស.ស (NSSF)"]
    ]
    add_feature_table(doc, pay_headers, pay_data, [1.8, 1.5, 3.2])

    # 2.6 Employee & Master Data
    add_header_styled(doc, "២.៦ ការគ្រប់គ្រងព័ត៌មានបុគ្គលិក និងរចនាសម្ព័ន្ធ (Employee & Master Data)", level=2)
    emp_headers = ["ទំព័រ/មុខងារ", "កូដប្រភព (Source)", "មុខងារស្នូល (Core Functions)"]
    emp_data = [
        ["Employee Directory (CRUD)", "Employees.jsx", "គ្រប់គ្រងប្រវត្តិរូបបុគ្គលិក (បន្ថែម, កែប្រែ, លុប, ផ្អាកការងារ), ព័ត៌មានផ្ទាល់ខ្លួន, កាលបរិច្ឆេទចូលបម្រើការងារ, រូបថត"],
        ["AI Face Enrollment", "FaceDataController.java", "ស្កេន និងចុះឈ្មោះផ្ទៃមុខបុគ្គលិក (128-dimensional facial descriptors) ដើម្បីយកទៅប្រើក្នុងការស្កេនមុខលើ Kiosk"],
        ["QR Code Badge Generator", "QrCodeController.java", "បង្កើតកាត QR Code សម្គាល់ខ្លួនបុគ្គលិកស្វ័យប្រវត្តិ (Printable Badge) ដែលមានសុវត្ថិភាព អាចទាញយកជា PDF ឬរូបភាព"],
        ["Departments Management", "Departments.jsx", "បង្កើត និងគ្រប់គ្រងដេប៉ាតឺម៉ង់/ផ្នែកផ្សេងៗក្នុងក្រុមហ៊ុន និងចាត់តាំងប្រធានផ្នែក"],
        ["Positions Management", "Positions.jsx", "បង្កើត និងគ្រប់គ្រងមុខតំណែងការងារ (Job Titles) ក្នុងក្រុមហ៊ុន"]
    ]
    add_feature_table(doc, emp_headers, emp_data, [1.8, 1.5, 3.2])

    # 2.7 Kiosk & Geofencing Settings
    add_header_styled(doc, "២.៧ ការគ្រប់គ្រងប្រព័ន្ធ Kiosk និង Geofencing (Kiosk & GPS Geofence)", level=2)
    kiosk_headers = ["មុខងារ", "កូដប្រភព", "មុខងារ និងបច្ចេកវិទ្យា (Features)"]
    kiosk_data = [
        ["Kiosk Mode Screen", "Kiosk.jsx", "ផ្ទាំង Fullscreen សម្រាប់ដាក់លើ Tablet/កុំព្យូទ័រនៅមាត់ទ្វារក្រុមហ៊ុន គាំទ្រការស្កេនមុខ (Face Recognition) និងស្កេន QR Code មានសំឡេងស្វាគមន៍"],
        ["Interactive Map Geofencing", "KioskSettings.jsx", "ផ្ទាំងផែនទី Leaflet Map សម្រាប់កំណត់ទីតាំងការិយាល័យ (Latitude, Longitude) និងរង្វង់កាំអនុញ្ញាត (Allowed Radius គិតជាម៉ែត្រ)"],
        ["Kiosk Security & Access", "KioskSettings.jsx", "កំណត់លេខកូដសម្ងាត់ (PIN/Token) សម្រាប់បើកដំណើរការ Kiosk និងកំណត់ការរឹតបន្តឹងលើ IP Address ឬ Wi-Fi"]
    ]
    add_feature_table(doc, kiosk_headers, kiosk_data, [1.8, 1.3, 3.4])

    # 2.8 Shift, Settings & Integrations
    add_header_styled(doc, "២.៨ វេនការងារ ការជូនដំណឹង និងសិទ្ធិប្រព័ន្ធ (Shifts, Alerts & Permissions)", level=2)
    misc_headers = ["មុខងារ", "កូដប្រភព", "មុខងារ (Features)"]
    misc_data = [
        ["Work Shifts Configuration", "WorkHours.jsx", "កំណត់វេនធ្វើការ (ម៉ោងចូល, ម៉ោងចេញ, ម៉ោងសម្រាកបាយថ្ងៃត្រង់), កំណត់នាទីអនុគ្រោះពេលមកយឺត (Late Grace Period)"],
        ["Telegram Bot Integration", "TelegramSettings.jsx", "ភ្ជាប់ Bot Telegram ដើម្បីបាញ់ Notification ដោយស្វ័យប្រវត្តិចូល Group រាល់ពេលមានបុគ្គលិក Check In/Out ឬសុំច្បាប់"],
        ["Firebase Push Campaigns", "PushNotifications.jsx", "ផ្ញើសារ Push Notification ទៅកាន់ Mobile App របស់បុគ្គលិកទាំងអស់ ឬតាមផ្នែកជាក់លាក់ (សេចក្តីជូនដំណឹង, រំលឹកម៉ោង)"],
        ["Role-Based Permissions", "Permissions.jsx", "កំណត់សិទ្ធិលម្អិតតាម Menu/Feature នីមួយៗ (Read, Write, Edit, Delete, Approve) សម្រាប់ Role នីមួយៗ"],
        ["Reports & Data Export", "Reports.jsx", "ទាញយករបាយការណ៍សង្ខេបវត្តមានប្រចាំខែ/សប្តាហ៍ ជាទម្រង់ Excel (.xlsx) និង PDF ផ្លូវការ"]
    ]
    add_feature_table(doc, misc_headers, misc_data, [1.8, 1.4, 3.3])

    # ----------------------------------------------------
    # SECTION 3: MOBILE APPLICATION FEATURES
    # ----------------------------------------------------
    add_header_styled(doc, "ផ្នែកទី ៣៖ មុខងារលម្អិតទាំងអស់នៃ MOBILE APPLICATION (Flutter App)", level=1)
    
    p = doc.add_paragraph()
    p.add_run("Mobile Application ត្រូវបានអភិវឌ្ឍឡើងដោយប្រើ Flutter Framework ដំណើរការបានទាំងលើប្រព័ន្ធប្រតិបត្តិការ Android និង iOS ដែលផ្តល់ភាពងាយស្រួលដល់បុគ្គលិក និងថ្នាក់គ្រប់គ្រងក្នុងការប្រើប្រាស់ប្រចាំថ្ងៃគ្រប់ពេលវេលា។ ខាងក្រោមជាមុខងារសំខាន់ៗ៖")
    p.paragraph_format.space_after = Pt(6)

    mob_headers = ["អេក្រង់/មុខងារ (Screen)", "កូដប្រភព (Source)", "មុខងារលម្អិត (Detailed Capabilities)"]
    mob_data = [
        ["Login & Biometrics", "login_screen.dart\nauth_controller.dart", "ចូលប្រើប្រាស់ដោយ Email & Password, រក្សាទុក Token សុវត្ថិភាព, គាំទ្រការស្កេនស្នាមម្រាមដៃ ឬ Face ID (Biometric Authentication) លើទូរស័ព្ទ"],
        ["Smart Check-In / Check-Out", "home_screen.dart\nattendance_controller.dart", "ប៊ូតុង Check-In / Check-Out ឆ្លាតវៃជាមួយ GPS Geofencing ផ្ទៀងផ្ទាត់ចម្ងាយពីក្រុមហ៊ុនជាក់ស្តែង, ការពារ Mock/Fake GPS, ថតរូប Selfie បញ្ជាក់វត្តមាន"],
        ["Today's Live Attendance Card", "home_screen.dart", "កាតបង្ហាញស្ថានភាពបច្ចុប្បន្នភាព៖ ម៉ោងចូល (In), ម៉ោងចេញ (Out), ចំនួនម៉ោងបានធ្វើការ (Worked Hours), និងស្ថានភាពយឺត ឬទៀងទាត់"],
        ["Attendance History & Calendar", "attendance_screen.dart", "ទិដ្ឋភាពប្រតិទិន និងបញ្ជីប្រវត្តិវត្តមានប្រចាំខែ, មើលព័ត៌មានលម្អិតរាល់ថ្ងៃ (ម៉ោង, ទីតាំងលើផែនទី, នាទីយឺត, ម៉ោងថែម, ស្ថានភាព៖ Present, Late, Leave, Absent)"],
        ["Mobile Leave Submission", "leave_screen.dart\nleave_controller.dart", "ស្នើសុំច្បាប់សម្រាកតាមទូរស័ព្ទ៖ ជ្រើសប្រភេទច្បាប់, ថ្ងៃចាប់ផ្តើម-បញ្ចប់, ហេតុផល, ថតរូប ឬភ្ជាប់ឯកសារបញ្ជាក់/វេជ្ជបញ្ជា, មើលកូតាច្បាប់នៅសល់"],
        ["Leave History Tracking", "leave_screen.dart", "តាមដានស្ថានភាពពាក្យសុំច្បាប់ផ្ទាល់ខ្លួន (រង់ចាំពិនិត្យ - Pending, បានអនុម័ត - Approved, បដិសេធ - Rejected) រួមទាំងកំណត់សម្គាល់ពីអ្នកគ្រប់គ្រង"],
        ["Manager Leave Approval on Mobile", "leave_approval_screen.dart", "ផ្ទាំងពិសេសសម្រាប់ Manager/ប្រធានផ្នែក ដើម្បីពិនិត្យពាក្យសុំច្បាប់របស់កូនចៅក្រោមឱវាទ និងចុច Approve ឬ Reject ជាមួយមតិយោបល់ភ្លាមៗលើទូរស័ព្ទ"],
        ["Mobile Overtime (OT) Request", "overtime_screen.dart\novertime_controller.dart", "ស្នើសុំធ្វើការថែមម៉ោង (OT) តាមទូរស័ព្ទ បញ្ជាក់ម៉ោងចាប់ផ្តើម-បញ្ចប់ និងភារកិច្ច រួចតាមដានស្ថានភាពអនុម័ត"],
        ["Digital Employee ID Badge", "profile_screen.dart", "បង្ហាញកាតបុគ្គលិកឌីជីថល (Digital Badge) ជាមួយរូបថត ព័ត៌មានការងារ និង QR Code សម្រាប់យកទៅស្កេនលើ Kiosk ពេលមកដល់ក្រុមហ៊ុន"],
        ["Multi-Language Switcher", "language_controller.dart", "ប្តូរភាសាប្រើប្រាស់បាន ២ ភាសាភ្លាមៗ៖ ភាសាខ្មែរ (Khmer) និង ភាសាអង់គ្លេស (English) ដោយមិនចាំបាច់ Restart App"],
        ["Dark / Light Theme Toggle", "theme_controller.dart", "គាំទ្រផ្ទៃពណ៌ស្រាល (Light Mode) និងផ្ទៃពណ៌ងងឹត (Dark Mode) ស្រួលភ្នែកពេលយប់"],
        ["FCM Push Notifications", "notification_controller.dart", "ទទួលសារ Notification ភ្លាមៗពេល៖ ដល់ម៉ោង Check In/Out, សំណើច្បាប់/OT ត្រូវបានអនុម័ត ឬបដិសេធ, និងសេចក្តីជូនដំណឹងពីក្រុមហ៊ុន"],
        ["App Maintenance & Force Update", "maintenance_screen.dart", "ភ្ជាប់ជាមួយ Firebase Remote Config ដើម្បីបង្ហាញផ្ទាំងបិទថែទាំប្រព័ន្ធ ឬដាស់តឿនឱ្យ Update App កំណែថ្មីដោយស្វ័យប្រវត្តិ"]
    ]
    add_feature_table(doc, mob_headers, mob_data, [1.8, 1.6, 3.1])

    # ----------------------------------------------------
    # SECTION 4: INTEGRATIONS & SMART TECHNOLOGIES
    # ----------------------------------------------------
    add_header_styled(doc, "ផ្នែកទី ៤៖ បច្ចេកវិទ្យាឆ្លាតវៃ និងការតភ្ជាប់ស្វ័យប្រវត្តិ (Smart Tech & Integrations)", level=1)
    
    add_callout(doc, "ប្រព័ន្ធផ្ទៀងផ្ទាត់ទីតាំង GPS Geofencing", 
                "Mobile App ប្រើប្រាស់ Geolocator API គួបផ្សំនឹងរូបមន្ត Haversine លើ Backend ដើម្បីគណនាចម្ងាយពិតប្រាកដរវាងទូរស័ព្ទបុគ្គលិក និងកូអរដោនេការិយាល័យ។ ប្រព័ន្ធនឹងបដិសេធការ Check-in ប្រសិនបើបុគ្គលិកស្ថិតនៅក្រៅរង្វង់កាំអនុញ្ញាត (Allowed Radius) ឬបើកកម្មវិធីបន្លំទីតាំង (Mock Location)។", "info")

    add_callout(doc, "បច្ចេកវិទ្យាស្កេនមុខឆ្លាតវៃ AI Facial Recognition", 
                "នៅលើ Kiosk Mode ប្រព័ន្ធប្រើប្រាស់ AI Face-API ដើម្បីទាញយកទិន្នន័យចំណុចពិសេសផ្ទៃមុខ (128-point face descriptors) និងធ្វើការប្រៀបធៀបជាមួយទិន្នន័យដែលបានចុះឈ្មោះក្នុង Database ដោយប្រើក្បួនគណនា Euclidean Distance ដែលមានភាពសុក្រឹតខ្ពស់ និងរហ័សក្នុងកម្រិតមិល្លីវិនាទី។", "purple")

    add_callout(doc, "ប្រព័ន្ធជូនដំណឹងស្វ័យប្រវត្តិតាម Telegram Bot", 
                "Backend ត្រូវបានបំពាក់ Telegram Webhook/API Service ដែលនឹងផ្ញើសារស្វ័យប្រវត្តិចូល Group រដ្ឋបាល ឬ Group ក្រុមហ៊ុន រាល់ពេលបុគ្គលិក Check In/Out (បង្ហាញឈ្មោះ, ម៉ោង, ស្ថានភាពយឺត/ទៀងទាត់) និងរាល់ពេលមានពាក្យសុំច្បាប់ថ្មី។", "success")

    add_callout(doc, "Firebase Cloud Messaging (FCM) Push Service", 
                "រាល់ពេល Manager អនុម័តច្បាប់ ឬ HR ចេញសេចក្តីប្រកាស ប្រព័ន្ធនឹងបាញ់ Silent & Visual Push Notifications ទៅដល់ទូរស័ព្ទដៃរបស់បុគ្គលិកភ្លាមៗ ទោះបីជាបុគ្គលិកបិទ App ក៏ដោយ។", "warning")

    # ----------------------------------------------------
    # SECTION 5: COMPARISON & WORKFLOW MATRIX
    # ----------------------------------------------------
    add_header_styled(doc, "ផ្នែកទី ៥៖ តារាងប្រៀបធៀបមុខងាររវាង Website និង Mobile App (Feature Matrix)", level=1)
    
    matrix_headers = ["ម៉ូឌុលមុខងារ (Module)", "Website Portal", "Mobile App", "កត់សម្គាល់ (Remarks)"]
    matrix_data = [
        ["Check-In / Check-Out", "គាំទ្រតាម Kiosk (Face/QR)", "គាំទ្រតាមទូរស័ព្ទ (GPS Geofence)", "អាចប្រើរួមគ្នាទាំងពីរជម្រើស"],
        ["Dashboard & Reports", "ស្ថិតិ និងក្រាហ្វិកកម្រិតខ្ពស់", "សង្ខេបផ្ទាល់ខ្លួនប្រចាំថ្ងៃ", "Web សម្រាប់ HR, App សម្រាប់បុគ្គលិក"],
        ["Leave Submission", "មាន (សម្រាប់ Admin បញ្ចូលជំនួស)", "មាន (បុគ្គលិកស្នើសុំផ្ទាល់ខ្លួន)", "ភ្ជាប់ឯកសារ ឬថតរូបបាន"],
        ["Leave Approval", "មាន (HR & Admin)", "មាន (Manager/ប្រធានផ្នែក)", "Manager អាច Approve លើទូរស័ព្ទបាន"],
        ["Overtime Management", "គ្រប់គ្រង និងអនុម័តទាំងមូល", "ស្នើសុំ និងតាមដានលទ្ធផល", "គណនាចូល Payroll ដោយស្វ័យប្រវត្តិ"],
        ["Payroll & Payslips", "គ្រប់គ្រង រត់ប្រាក់ខែ និង Print", "មើលប័ណ្ណបើកប្រាក់ខែផ្ទាល់ខ្លួន", "ធានាសម្ងាត់ទិន្នន័យបុគ្គលិក"],
        ["Face Scan Enrollment", "មាន (តាមរយៈ Webcam/Upload)", "មិនមាន (ធ្វើឡើងដោយ HR)", "ដើម្បីសុវត្ថិភាពទិន្នន័យជីវមាត្រ"],
        ["QR Badge Generation", "បង្កើត និងទាញយកជា PDF", "បង្ហាញជា Digital Badge លើអេក្រង់", "ប្រើសម្រាប់ស្កេនមាត់ទ្វារ"],
        ["Push Notifications", "ផ្ញើ និងគ្រប់គ្រង Campaign", "ទទួលដំណឹង និងបើកមើល", "ប្រើប្រាស់ Firebase FCM"],
        ["Telegram Bot Alerts", "កំណត់ Settings & Test Bot", "មិនមាន (Alert ចូល Telegram)", "ផ្តល់ដំណឹងចូល Group រួម"],
        ["Language Switching", "Khmer / English", "Khmer / English", "ប្តូរបានទាំងសងខាង"]
    ]
    add_feature_table(doc, matrix_headers, matrix_data, [1.8, 1.5, 1.5, 1.7])

    # ----------------------------------------------------
    # SECTION 6: CONCLUSION & TECHNICAL RECOMMENDATIONS
    # ----------------------------------------------------
    add_header_styled(doc, "ផ្នែកទី ៦៖ សេចក្តីសន្និដ្ឋាន និងការណែនាំបច្ចេកទេស (Conclusion & Recommendations)", level=1)
    
    conc_p = doc.add_paragraph()
    conc_p.add_run("ប្រព័ន្ធគ្រប់គ្រងវត្តមាន ច្បាប់ និងប្រាក់បៀវត្សរ៍ KHY-HENG គឺជាដំណោះស្រាយពេញលេញ (All-in-One HR & Attendance Solution) ដែលបានផ្សារភ្ជាប់យ៉ាងរលូនរវាងប្រតិបត្តិការការិយាល័យតាម Website និងការអនុវត្តការងារផ្ទាល់របស់បុគ្គលិកតាមរយៈ Mobile App។\n\n")
    conc_p.add_run("អត្ថប្រយោជន៍ចម្បងៗដែលទទួលបានពីប្រព័ន្ធរួមមាន៖\n")
    
    benefits = [
        "លុបបំបាត់ការបន្លំវត្តមានទាំងស្រុង (No Buddy Punching) តាមរយៈការរួមបញ្ចូលគ្នារវាង AI Face Recognition, Dynamic QR Code និង GPS Geofencing Radius។",
        "កាត់បន្ថយពេលវេលាការងាររដ្ឋបាល (Save HR Time) ដោយសារប្រព័ន្ធគណនាម៉ោងធ្វើការ ម៉ោងយឺត ម៉ោងថែម និងកាត់ប្រាក់បៀវត្សរ៍ដោយស្វ័យប្រវត្តិ។",
        "បង្កើនភាពងាយស្រួលដល់បុគ្គលិក និងអ្នកគ្រប់គ្រង ក្នុងការស្នើសុំ និងអនុម័តច្បាប់សម្រាកបានគ្រប់ពេលវេលា និងគ្រប់ទីកន្លែងតាមទូរស័ព្ទដៃ។",
        "ការជូនដំណឹងរហ័សទាន់ចិត្ត (Instant Transparency) តាមរយៈ Telegram Bot ផ្ទាល់ និង Firebase Push Notifications។"
    ]
    for b in benefits:
        bp = doc.add_paragraph()
        bp.paragraph_format.left_indent = Inches(0.25)
        bp.paragraph_format.space_before = Pt(2)
        bp.paragraph_format.space_after = Pt(2)
        r_bullet = bp.add_run("✔ ")
        r_bullet.bold = True
        r_bullet.font.color.rgb = RGBColor(0, 153, 76)
        r_txt = bp.add_run(b)
        r_txt.font.name = "Khmer OS Siemreap"
        r_txt.font.size = Pt(9.5)

    doc.add_paragraph().paragraph_format.space_after = Pt(12)
    
    # Signatures
    sig_tbl = doc.add_table(rows=2, cols=2)
    sig_tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    sig_tbl.columns[0].width = Inches(3.25)
    sig_tbl.columns[1].width = Inches(3.25)
    set_table_borders(sig_tbl, val="none")
    
    s0 = sig_tbl.cell(0, 0)
    s1 = sig_tbl.cell(0, 1)
    
    p_s0 = s0.paragraphs[0]
    p_s0.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r_s0 = p_s0.add_run("រៀបចំដោយក្រុមការងារបច្ចេកទេស (Prepared by)\n\n\n\n___________________________\nKHY-HENG Development Team")
    r_s0.font.name = "Khmer OS Siemreap"
    r_s0.font.size = Pt(9.5)
    
    p_s1 = s1.paragraphs[0]
    p_s1.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r_s1 = p_s1.add_run("ពិនិត្យ និងយល់ព្រមដោយ (Approved by)\n\n\n\n___________________________\nManagement / Project Owner")
    r_s1.font.name = "Khmer OS Siemreap"
    r_s1.font.size = Pt(9.5)

    doc.save(file_path)
    print(f"Successfully generated Word document at: {file_path}")

if __name__ == "__main__":
    out_file = r"d:\project\KHY-HENG_Attendance\KHY_HENG_Attendance_System_Features_Specification.docx"
    build_document(out_file)

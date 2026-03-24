import sys

file_path = r'C:/Users/mansi/OneDrive/Desktop/Internship/Employee_Tracking/Employee_Tracking/Employee-tracking-App/src/EmployeeWorkTrackingApp/pages/AdminDashboard.jsx'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find the start of the modal (<AnimatePresence> containing showAddDeptModal)
modal_start = -1
for i, line in enumerate(lines):
    if '<AnimatePresence>' in line and i + 1 < len(lines) and 'showAddDeptModal &&' in lines[i+1]:
        modal_start = i
        break

if modal_start == -1:
    print("Could not find modal start")
    sys.exit(1)

# Find the end of the modal (the closing </AnimatePresence> after modal_start)
modal_end = -1
open_tags = 0
for i in range(modal_start, len(lines)):
    if '<AnimatePresence' in lines[i]:
        open_tags += lines[i].count('<AnimatePresence')
    if '</AnimatePresence>' in lines[i]:
        open_tags -= lines[i].count('</AnimatePresence>')
        if open_tags == 0:
            modal_end = i
            break

if modal_end == -1:
    print("Could not find modal end")
    sys.exit(1)

# Extract the form content (inside the second motion.div)
# We actually just want the form and header, but I'll write exactly what we need.
# Wait, let's just use the known structure from the file.

# Find `case "departments":`
dept_start = -1
for i, line in enumerate(lines):
    if 'case "departments":' in line:
        dept_start = i
        break

if dept_start == -1:
    print("Could not find departments case")
    sys.exit(1)

# Now, we want to extract the form lines.
form_start = -1
for i in range(modal_start, modal_end):
    if '<form onSubmit={handleAddNewDepartment}' in lines[i]:
        form_start = i
        break

form_end = -1
for i in range(form_start, modal_end):
    if '</form>' in lines[i]:
        form_end = i
        break

form_lines = lines[form_start:form_end+1]

# Construct the inline form block to place into `case "departments":`
inj1 = """        if (showAddDeptModal) {
          return (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full max-w-4xl mx-auto space-y-6"
            >
              <div className="flex items-center justify-between mb-8">
                <h1 className={`text-3xl font-bold ${isDark ? "text-white" : "text-gray-800"}`}>
                  <i className={`fas ${editingDeptId ? "fa-edit" : "fa-plus-circle"} mr-3 text-emerald-500`}></i> 
                  {editingDeptId ? "Edit Department" : "Add Department"}
                </h1>
              </div>

              <div className={`rounded-3xl shadow-xl overflow-hidden border ${isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100"}`}>
                <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-6 flex flex-col md:flex-row md:items-center justify-between">
                  <div>
                     <h2 className="text-2xl font-bold text-white flex items-center mb-1">
                       <i className={`fas ${editingDeptId ? "fa-edit" : "fa-building"} mr-3`}></i> {editingDeptId ? "Edit Department Details" : "New Department Details"}
                     </h2>
                     <p className="text-emerald-100/90 text-sm ml-8">Fill the required information below</p>
                  </div>
                </div>
"""
inj2 = """              </div>
            </motion.div>
          );
        }
"""

inj_lines = inj1.splitlines(True) + form_lines + inj2.splitlines(True)

# Combine parts
# We delete the modal lines
lines = lines[:modal_start] + lines[modal_end+1:]

# Dept start might have shifted if modal was BEFORE it, but modal is at the end, so dept_start is unchanged (or we recalculate)
dept_start = -1
for i, line in enumerate(lines):
    if 'case "departments":' in line:
        dept_start = i
        break

# Insert the injection block directly after `case "departments":`
lines = lines[:dept_start+1] + inj_lines + lines[dept_start+1:]

# Now modify `onSectionChange` and `onDeptAction` to clear the modal
for i, line in enumerate(lines):
    if 'setPresentSubFilter("all");' in line:
        lines.insert(i+1, '            setShowAddDeptModal(false);\n')
        break

for i, line in enumerate(lines):
    if 'setDeptActionView(action);' in line:
        lines.insert(i+1, '            setShowAddDeptModal(false);\n')
        break

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(lines)

print("SUCCESS")

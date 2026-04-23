import XLSX from 'xlsx'
import path from 'node:path'

const departments = [
  { department_id: 'D001', department_name: 'Engineering', location: 'London' },
  { department_id: 'D002', department_name: 'Finance', location: 'Manchester' },
  { department_id: 'D003', department_name: 'Marketing', location: 'Leeds' },
  { department_id: 'D004', department_name: 'HR', location: 'Birmingham' },
]

const employees = [
  {
    employee_id: 'E001',
    employee_name: 'Alice Carter',
    email: 'alice.carter@company.com',
    department_id: 'D001',
    title: 'Senior Engineer',
  },
  {
    employee_id: 'E002',
    employee_name: 'Ben Lewis',
    email: 'ben.lewis@company.com',
    department_id: 'D001',
    title: 'Data Engineer',
  },
  {
    employee_id: 'E003',
    employee_name: 'Chloe Martin',
    email: 'chloe.martin@company.com',
    department_id: 'D002',
    title: 'Financial Analyst',
  },
  {
    employee_id: 'E004',
    employee_name: 'Daniel Green',
    email: 'daniel.green@company.com',
    department_id: 'D003',
    title: 'Marketing Specialist',
  },
  {
    employee_id: 'E005',
    employee_name: 'Ella Brooks',
    email: 'ella.brooks@company.com',
    department_id: 'D004',
    title: 'HR Manager',
  },
  {
    employee_id: 'E006',
    employee_name: 'Farhan Khan',
    email: 'farhan.khan@company.com',
    department_id: 'D001',
    title: 'Frontend Engineer',
  },
]

const projects = [
  {
    project_id: 'P1001',
    project_name: 'Payroll Automation',
    department_id: 'D002',
    employee_id: 'E003',
    role_on_project: 'Lead Analyst',
    status: 'In Progress',
  },
  {
    project_id: 'P1002',
    project_name: 'Website Revamp',
    department_id: 'D001',
    employee_id: 'E006',
    role_on_project: 'Frontend Lead',
    status: 'In Progress',
  },
  {
    project_id: 'P1003',
    project_name: 'Data Warehouse Upgrade',
    department_id: 'D001',
    employee_id: 'E002',
    role_on_project: 'Data Engineer',
    status: 'Planned',
  },
  {
    project_id: 'P1004',
    project_name: 'Employer Branding Campaign',
    department_id: 'D003',
    employee_id: 'E004',
    role_on_project: 'Campaign Owner',
    status: 'Completed',
  },
  {
    project_id: 'P1005',
    project_name: 'Onboarding Redesign',
    department_id: 'D004',
    employee_id: 'E005',
    role_on_project: 'Program Owner',
    status: 'In Progress',
  },
  {
    project_id: 'P1006',
    project_name: 'API Performance Tuning',
    department_id: 'D001',
    employee_id: 'E001',
    role_on_project: 'Backend Lead',
    status: 'Completed',
  },
]

function writeWorkbook(fileName, sheetName, rows) {
  const workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.json_to_sheet(rows)
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
  const filePath = path.resolve('sample-data', fileName)
  XLSX.writeFile(workbook, filePath)
  return filePath
}

const outputs = [
  writeWorkbook('employees.xlsx', 'employees', employees),
  writeWorkbook('departments.xlsx', 'departments', departments),
  writeWorkbook('projects.xlsx', 'projects', projects),
]

console.log('Generated files:')
outputs.forEach((file) => console.log(file))

// ============================================================
// CMS - ADMIN JAVASCRIPT
// File: js/admin.js
// ============================================================

// ============================================================
// PAGE LOAD
// ============================================================

document.addEventListener("DOMContentLoaded", function () {

syncDirectoryRecords();

// Load dashboard
loadDashboard();

// Load doctors
loadDoctors();

// Load staff
loadStaff();

loadUsers();
updateStaffRoleFields();

});

// ============================================================
// DASHBOARD
// ============================================================

function loadDashboard() {

const doctors = getDoctors();

const staff = getStaff();

const users = getUsers();


// Total Doctors
const totalDoctors =
    document.getElementById("totalDoctors");

if (totalDoctors) {

    totalDoctors.textContent =
        doctors.length;

}


// Total Staff
const totalStaff =
    document.getElementById("totalStaff");

if (totalStaff) {

    totalStaff.textContent =
        staff.length;

}


// Total Users
const totalUsers =
    document.getElementById("totalUsers");

if (totalUsers) {

    totalUsers.textContent =
        users.length;

}


// Active Users
const activeUsers =
    document.getElementById("activeUsers");

if (activeUsers) {

    const active =
        users.filter(function (user) {

            return user.status === "Active";

        });

    activeUsers.textContent =
        active.length;

}

}

// ============================================================
// DASHBOARD NAVIGATION
// ============================================================

function goToDoctors() {

window.location.href =
    "doctor-management.html";

}

function goToStaff() {

window.location.href =
    "staff-management.html";

}

function goToUsers() {

window.location.href =
    "user-management.html";

}

// ============================================================
// DOCTOR MANAGEMENT
// ============================================================

// ADD DOCTOR

function syncLinkedAccounts(profileType, profileId, updates) {
    if (!profileId) return;

    const users = getUsers();
    let changed = false;

    users.forEach(function (user) {
        if (user.profileType === profileType && user.profileId === profileId) {
            Object.assign(user, updates);
            changed = true;
        }
    });

    if (changed) saveUsers(users);
}

function syncDirectoryRecords() {
    getDoctors().forEach(syncDoctorStaffRecord);

    getStaff().forEach(function (person) {
        if (person.role === "Doctor" && person.specialization) {
            syncDoctorProfileFromStaff(person, person.specialization);
        }
    });
}

function syncDoctorStaffRecord(doctor) {

const staff = getStaff();
let person = staff.find(function (item) {
    return item.id === doctor.staffId || item.doctorId === doctor.id;
});

if (!person) {
    person = staff.find(function (item) {
        return item.role === "Doctor" && item.email.toLowerCase() === doctor.email.toLowerCase();
    });
}

if (!person) {
    person = {
        id: doctor.staffId || generateId("STAFF"),
        createdAt: doctor.createdAt
    };
    staff.push(person);
}

doctor.staffId = person.id;
Object.assign(person, {
    doctorId: doctor.id,
    name: doctor.name,
    email: doctor.email,
    phone: doctor.phone,
    role: "Doctor",
    specialization: doctor.specialization,
    status: doctor.status
});

saveStaff(staff);
const doctors = getDoctors();
const storedDoctor = doctors.find(function (item) {
    return item.id === doctor.id;
});
if (storedDoctor) {
    storedDoctor.staffId = doctor.staffId;
    saveDoctors(doctors);
}
syncLinkedAccounts("doctor", doctor.id, {
    name: doctor.name,
    email: doctor.email,
    role: "Doctor",
    status: doctor.status
});

}

function removeDoctorStaffRecord(doctor) {
    const staff = getStaff().filter(function (person) {
        return person.id !== doctor.staffId && person.doctorId !== doctor.id;
    });
    saveStaff(staff);
    syncLinkedAccounts("doctor", doctor.id, { status: "Inactive" });
}

function addDoctor() {

const name = document.getElementById("doctorName").value.trim();
const email = document.getElementById("doctorEmail").value.trim();
const phone = document.getElementById("doctorPhone").value.trim();
const specialization = document.getElementById("doctorSpecialization").value.trim();

if (!name || !email || !phone || !specialization) {
    alert("Please fill all doctor details.");
    return;
}

const doctors = getDoctors();
const staff = getStaff();
const duplicateDoctor = doctors.some(function (item) {
    return item.email.toLowerCase() === email.toLowerCase();
});
const matchingStaff = staff.find(function (person) {
    return person.email.toLowerCase() === email.toLowerCase();
});

if (duplicateDoctor || (matchingStaff && matchingStaff.role !== "Doctor")) {
    alert("A person with this email already exists. Check the staff and doctor directories.");
    return;
}

const doctor = {
    id: generateId("DOC"),
    staffId: matchingStaff ? matchingStaff.id : generateId("STAFF"),
    name: name,
    email: email,
    phone: phone,
    specialization: specialization,
    status: "Active",
    createdAt: new Date().toLocaleDateString()
};

doctors.push(doctor);
saveDoctors(doctors);
syncDoctorStaffRecord(doctor);

alert("Doctor added successfully.");
document.getElementById("doctorForm").reset();
loadDoctors();

}

// LOAD DOCTORS

function loadDoctors() {

const tableBody =
    document.getElementById(
        "doctorTableBody"
    );


// If this is not doctor page

if (!tableBody) {

    return;

}


const doctors = getDoctors();


tableBody.innerHTML = "";


// No doctors

if (doctors.length === 0) {

    tableBody.innerHTML = `

        <tr>

            <td colspan="7">
                No doctors found.
            </td>

        </tr>

    `;

    return;

}


// Display doctors

doctors.forEach(function (doctor) {

    const row =
        document.createElement("tr");


    row.innerHTML = `

        <td>${doctor.id}</td>

        <td>${doctor.name}</td>

        <td>${doctor.email}</td>

        <td>${doctor.phone}</td>

        <td>${doctor.specialization}</td>

        <td>${doctor.status}</td>

        <td>

            <button
                onclick="editDoctor('${doctor.id}')">
                Edit
            </button>

            <button
                onclick="toggleDoctorStatus('${doctor.id}')">
                ${
                    doctor.status === "Active"
                    ? "Deactivate"
                    : "Activate"
                }
            </button>

            <button
                onclick="deleteDoctor('${doctor.id}')">
                Delete
            </button>

        </td>

    `;


    tableBody.appendChild(row);

});

}

// EDIT DOCTOR

function editDoctor(id) {

const doctors = getDoctors();


const doctor =
    doctors.find(function (item) {

        return item.id === id;

    });


if (!doctor) {

    alert("Doctor not found.");

    return;

}


const name =
    prompt(
        "Enter doctor name:",
        doctor.name
    );


if (name === null) {

    return;

}


const email =
    prompt(
        "Enter doctor email:",
        doctor.email
    );


if (email === null) {

    return;

}


const phone =
    prompt(
        "Enter doctor phone:",
        doctor.phone
    );


if (phone === null) {

    return;

}


const specialization =
    prompt(
        "Enter specialization:",
        doctor.specialization
    );


if (specialization === null) {

    return;

}


doctor.name =
    name.trim();

doctor.email =
    email.trim();

doctor.phone =
    phone.trim();

doctor.specialization =
    specialization.trim();


saveDoctors(doctors);
syncDoctorStaffRecord(doctor);


alert(
    "Doctor updated successfully."
);


loadDoctors();

}

// DELETE DOCTOR

function deleteDoctor(id) {

const confirmDelete =
    confirm(
        "Are you sure you want to delete this doctor?"
    );


if (!confirmDelete) {

    return;

}


const doctor = getDoctors().find(function (item) {
    return item.id === id;
});


deleteById(
    STORAGE_KEYS.doctors,
    id
);

if (doctor) {
    removeDoctorStaffRecord(doctor);
}


alert(
    "Doctor deleted successfully."
);


loadDoctors();

}

// TOGGLE DOCTOR STATUS

function toggleDoctorStatus(id) {

const doctors = getDoctors();


const doctor =
    doctors.find(function (item) {

        return item.id === id;

    });


if (!doctor) {

    return;

}


if (doctor.status === "Active") {

    doctor.status = "Inactive";

} else {

    doctor.status = "Active";

}


saveDoctors(doctors);
syncDoctorStaffRecord(doctor);


loadDoctors();

}

// SEARCH DOCTORS

function searchDoctors() {

const search =
    document.getElementById(
        "doctorSearch"
    ).value
    .toLowerCase()
    .trim();


const doctors = getDoctors();


const filteredDoctors =
    doctors.filter(function (doctor) {

        return (

            doctor.name
                .toLowerCase()
                .includes(search)

            ||

            doctor.email
                .toLowerCase()
                .includes(search)

            ||

            doctor.specialization
                .toLowerCase()
                .includes(search)

        );

    });


displayDoctors(
    filteredDoctors
);

}

// DISPLAY SEARCHED DOCTORS

function displayDoctors(doctors) {

const tableBody =
    document.getElementById(
        "doctorTableBody"
    );


if (!tableBody) {

    return;

}


tableBody.innerHTML = "";


if (doctors.length === 0) {

    tableBody.innerHTML = `

        <tr>

            <td colspan="7">
                No doctors found.
            </td>

        </tr>

    `;

    return;

}


doctors.forEach(function (doctor) {

    const row =
        document.createElement("tr");


    row.innerHTML = `

        <td>${doctor.id}</td>

        <td>${doctor.name}</td>

        <td>${doctor.email}</td>

        <td>${doctor.phone}</td>

        <td>${doctor.specialization}</td>

        <td>${doctor.status}</td>

        <td>

            <button
                onclick="editDoctor('${doctor.id}')">
                Edit
            </button>

            <button
                onclick="toggleDoctorStatus('${doctor.id}')">
                ${
                    doctor.status === "Active"
                    ? "Deactivate"
                    : "Activate"
                }
            </button>

            <button
                onclick="deleteDoctor('${doctor.id}')">
                Delete
            </button>

        </td>

    `;


    tableBody.appendChild(row);

});

}

// ============================================================
// STAFF MANAGEMENT
// ============================================================

// ADD STAFF

function updateStaffRoleFields() {
    const roleInput = document.getElementById("staffRole");
    const specializationField = document.getElementById("doctor-specialization-field");
    const specializationInput = document.getElementById("staffSpecialization");

    if (!roleInput || !specializationField || !specializationInput) return;

    const isDoctor = roleInput.value === "Doctor";
    specializationField.hidden = !isDoctor;
    specializationInput.required = isDoctor;
}

function syncDoctorProfileFromStaff(person, specialization) {
    const doctors = getDoctors();
    let doctor = doctors.find(function (item) {
        return item.id === person.doctorId || item.staffId === person.id;
    });

    if (!doctor) {
        doctor = {
            id: generateId("DOC"),
            staffId: person.id,
            createdAt: person.createdAt
        };
        doctors.push(doctor);
    }

    Object.assign(doctor, {
        staffId: person.id,
        name: person.name,
        email: person.email,
        phone: person.phone,
        specialization: specialization,
        status: person.status
    });
    person.doctorId = doctor.id;
    person.specialization = specialization;

    const staff = getStaff();
    const storedPerson = staff.find(function (item) {
        return item.id === person.id;
    });
    if (storedPerson) Object.assign(storedPerson, person);

    saveDoctors(doctors);
    saveStaff(staff);
    syncLinkedAccounts("staff", person.id, {
        profileType: "doctor",
        profileId: doctor.id,
        name: person.name,
        email: person.email,
        role: "Doctor",
        status: person.status
    });
    syncLinkedAccounts("doctor", doctor.id, {
        name: person.name,
        email: person.email,
        role: "Doctor",
        status: person.status
    });
}

function removeDoctorProfileForStaff(person) {
    const existingDoctors = getDoctors();
    const linkedDoctors = existingDoctors.filter(function (doctor) {
        return doctor.id === person.doctorId || doctor.staffId === person.id;
    });

    linkedDoctors.forEach(function (doctor) {
        syncLinkedAccounts("doctor", doctor.id, {
            profileType: "staff",
            profileId: person.id,
            role: person.role,
            name: person.name,
            email: person.email,
            status: person.status
        });
    });

    const doctors = existingDoctors.filter(function (doctor) {
        return doctor.id !== person.doctorId && doctor.staffId !== person.id;
    });
    saveDoctors(doctors);
}

function addStaff() {

const name = document.getElementById("staffName").value.trim();
const email = document.getElementById("staffEmail").value.trim();
const phone = document.getElementById("staffPhone").value.trim();
const role = document.getElementById("staffRole").value;
const specializationInput = document.getElementById("staffSpecialization");
const specialization = specializationInput ? specializationInput.value.trim() : "";

if (!name || !email || !phone || !role || (role === "Doctor" && !specialization)) {
    alert("Please fill all required staff details.");
    return;
}

const staff = getStaff();
const duplicateStaff = staff.some(function (person) {
    return person.email.toLowerCase() === email.toLowerCase();
});
const duplicateDoctor = role === "Doctor" && getDoctors().some(function (doctor) {
    return doctor.email.toLowerCase() === email.toLowerCase();
});

if (duplicateStaff || duplicateDoctor) {
    alert("A person with this email already exists in the directory.");
    return;
}

const newStaff = {
    id: generateId("STAFF"),
    name: name,
    email: email,
    phone: phone,
    role: role,
    status: "Active",
    createdAt: new Date().toLocaleDateString()
};

staff.push(newStaff);
saveStaff(staff);

if (role === "Doctor") {
    syncDoctorProfileFromStaff(newStaff, specialization);
}

alert("Staff added successfully.");
document.getElementById("staffForm").reset();
updateStaffRoleFields();
loadStaff();

}

// LOAD STAFF

function loadStaff() {

const tableBody =
    document.getElementById(
        "staffTableBody"
    );


if (!tableBody) {

    return;

}


const staff = getStaff();


tableBody.innerHTML = "";


if (staff.length === 0) {

    tableBody.innerHTML = `

        <tr>

            <td colspan="7">
                No staff found.
            </td>

        </tr>

    `;

    return;

}


staff.forEach(function (person) {

    const row =
        document.createElement("tr");


    row.innerHTML = `

        <td>${person.id}</td>

        <td>${person.name}</td>

        <td>${person.email}</td>

        <td>${person.phone}</td>

        <td>${person.role}</td>

        <td>${person.status}</td>

        <td>

            <button
                onclick="editStaff('${person.id}')">
                Edit
            </button>

            <button
                onclick="toggleStaffStatus('${person.id}')">
                ${
                    person.status === "Active"
                    ? "Deactivate"
                    : "Activate"
                }
            </button>

            <button
                onclick="deleteStaff('${person.id}')">
                Delete
            </button>

        </td>

    `;


    tableBody.appendChild(row);

});

}

// EDIT STAFF

function editStaff(id) {

const staff = getStaff();


const person =
    staff.find(function (item) {

        return item.id === id;

    });


if (!person) {

    alert("Staff member not found.");

    return;

}


const name =
    prompt(
        "Enter staff name:",
        person.name
    );


if (name === null) return;


const email =
    prompt(
        "Enter staff email:",
        person.email
    );


if (email === null) return;


const phone =
    prompt(
        "Enter staff phone:",
        person.phone
    );


if (phone === null) return;


const role =
    prompt(
        "Enter role:\nDoctor\nReceptionist\nLab Technician\nPharmacist",
        person.role
    );


if (role === null) return;

const nextRole = role.trim();
const originalDoctorId = person.doctorId;
let specialization = person.specialization || "";

if (nextRole === "Doctor") {
    specialization = prompt("Enter doctor specialization:", specialization);
    if (specialization === null || !specialization.trim()) {
        alert("Doctor specialization is required.");
        return;
    }
    specialization = specialization.trim();
}

const duplicateStaff = staff.some(function (item) {
    return item.id !== id && item.email.toLowerCase() === email.trim().toLowerCase();
});
const duplicateDoctor = nextRole === "Doctor" && getDoctors().some(function (doctor) {
    return doctor.id !== originalDoctorId && doctor.email.toLowerCase() === email.trim().toLowerCase();
});

if (duplicateStaff || duplicateDoctor) {
    alert("A person with this email already exists in the directory.");
    return;
}


person.name =
    name.trim();

person.email =
    email.trim();

person.phone =
    phone.trim();

person.role =
    nextRole;


saveStaff(staff);

if (nextRole === "Doctor") {
    syncDoctorProfileFromStaff(person, specialization);
} else if (originalDoctorId || person.role === "Doctor") {
    person.doctorId = originalDoctorId;
    removeDoctorProfileForStaff(person);
    delete person.doctorId;
    delete person.specialization;
    saveStaff(staff);
    syncLinkedAccounts("staff", person.id, {
        name: person.name,
        email: person.email,
        role: person.role,
        status: person.status
    });
} else {
    syncLinkedAccounts("staff", person.id, {
        name: person.name,
        email: person.email,
        role: person.role,
        status: person.status
    });
}


alert(
    "Staff updated successfully."
);


loadStaff();

}

// DELETE STAFF

function deleteStaff(id) {

const confirmDelete =
    confirm(
        "Are you sure you want to delete this staff member?"
    );


if (!confirmDelete) {

    return;

}

const person = getStaff().find(function (item) {
    return item.id === id;
});


deleteById(
    STORAGE_KEYS.staff,
    id
);

if (person && person.role === "Doctor") {
    removeDoctorProfileForStaff(person);
    syncLinkedAccounts("staff", person.id, { status: "Inactive" });
} else if (person) {
    syncLinkedAccounts("staff", person.id, { status: "Inactive" });
}


alert(
    "Staff deleted successfully."
);


loadStaff();

}

// TOGGLE STAFF STATUS

function toggleStaffStatus(id) {

const staff = getStaff();


const person =
    staff.find(function (item) {

        return item.id === id;

    });


if (!person) {

    return;

}


person.status =
    person.status === "Active"
        ? "Inactive"
        : "Active";


saveStaff(staff);

if (person.role === "Doctor") {
    syncDoctorProfileFromStaff(person, person.specialization || "");
} else {
    syncLinkedAccounts("staff", person.id, {
        name: person.name,
        email: person.email,
        role: person.role,
        status: person.status
    });
}


loadStaff();

}

// SEARCH STAFF

function searchStaff() {

const search =
    document.getElementById(
        "staffSearch"
    ).value
    .toLowerCase()
    .trim();


const staff = getStaff();


const filteredStaff =
    staff.filter(function (person) {

        return (

            person.name
                .toLowerCase()
                .includes(search)

            ||

            person.email
                .toLowerCase()
                .includes(search)

            ||

            person.role
                .toLowerCase()
                .includes(search)

        );

    });


displayStaff(
    filteredStaff
);

}

// DISPLAY STAFF

function displayStaff(staff) {

const tableBody =
    document.getElementById(
        "staffTableBody"
    );


if (!tableBody) return;


tableBody.innerHTML = "";


if (staff.length === 0) {

    tableBody.innerHTML = `

        <tr>

            <td colspan="7">
                No staff found.
            </td>

        </tr>

    `;

    return;

}


staff.forEach(function (person) {

    const row =
        document.createElement("tr");


    row.innerHTML = `

        <td>${person.id}</td>

        <td>${person.name}</td>

        <td>${person.email}</td>

        <td>${person.phone}</td>

        <td>${person.role}</td>

        <td>${person.status}</td>

        <td>

            <button
                onclick="editStaff('${person.id}')">
                Edit
            </button>

            <button
                onclick="toggleStaffStatus('${person.id}')">
                ${
                    person.status === "Active"
                    ? "Deactivate"
                    : "Activate"
                }
            </button>

            <button
                onclick="deleteStaff('${person.id}')">
                Delete
            </button>

        </td>

    `;


    tableBody.appendChild(row);

});

}

// ============================================================
// USER MANAGEMENT
// ============================================================

// ADD USER

function addUser() {

const name =
    document.getElementById("userName")
        .value
        .trim();

const email =
    document.getElementById("userEmail")
        .value
        .trim();

const username =
    document.getElementById("userUsername")
        .value
        .trim()
        .toLowerCase();

const password =
    document.getElementById("userPassword")
        .value;

const role =
    document.getElementById("userRole")
        .value;

if (!name || !email || !username || !password || !role) {
    alert("Please fill all user details.");
    return;
}

if (password.length < 8) {
    alert("The temporary password must be at least 8 characters.");
    return;
}

const users = getUsers();
const reservedUsernames = [
    "admin"
];

if (reservedUsernames.includes(username) || users.some(function (user) {
    return user.username && user.username.toLowerCase() === username;
})) {
    alert("That username is already in use. Choose another username.");
    return;
}

const emailAlreadyExists = users.some(function (user) {
    return user.email.toLowerCase() === email.toLowerCase();
});

if (emailAlreadyExists) {
    alert("A user with this email already exists.");
    return;
}

let profile = null;
let profileType = null;

if (role === "Doctor") {
    profile = getDoctors().find(function (doctor) {
        return doctor.email.toLowerCase() === email.toLowerCase();
    });
    profileType = "doctor";
} else if (role !== "Admin") {
    profile = getStaff().find(function (person) {
        return person.email.toLowerCase() === email.toLowerCase() && person.role === role;
    });
    profileType = "staff";
}

if (role !== "Admin" && !profile) {
    alert("Add this person to the matching staff or doctor directory before creating a login.");
    return;
}

if (profile && profile.status !== "Active") {
    alert("Activate this staff or doctor profile before creating a login.");
    return;
}

const user = {
    id: generateId("USER"),
    name: name,
    email: email,
    username: username,
    password: password,
    role: role,
    profileId: profile ? profile.id : null,
    profileType: profileType,
    status: "Active",
    createdAt: new Date().toLocaleDateString()
};

users.push(user);
saveUsers(users);

alert("User added successfully.");
document.getElementById("userForm").reset();
loadUsers();

}

// LOAD USERS

function loadUsers() {

const tableBody =
    document.getElementById(
        "userTableBody"
    );


if (!tableBody) {

    return;

}


const users = getUsers();


tableBody.innerHTML = "";


if (users.length === 0) {

    tableBody.innerHTML = `

        <tr>

            <td colspan="7">
                No users found.
            </td>

        </tr>

    `;

    return;

}


users.forEach(function (user) {

    const row =
        document.createElement("tr");


    row.innerHTML = `

        <td>${user.id}</td>

        <td>${user.name}</td>

        <td>${user.email}</td>

        <td>${user.username || "-"}</td>

        <td>${user.role}</td>

        <td>${user.status}</td>

        <td>

            <button
                onclick="editUser('${user.id}')">
                Edit
            </button>

            <button
                onclick="toggleUserStatus('${user.id}')">
                ${
                    user.status === "Active"
                    ? "Deactivate"
                    : "Activate"
                }
            </button>

            <button
                onclick="deleteUser('${user.id}')">
                Delete
            </button>

        </td>

    `;


    tableBody.appendChild(row);

});

}

// EDIT USER

function editUser(id) {

const users = getUsers();


const user =
    users.find(function (item) {

        return item.id === id;

    });


if (!user) {

    alert("User not found.");

    return;

}


const name =
    prompt(
        "Enter user name:",
        user.name
    );


if (name === null) return;


const email =
    prompt(
        "Enter user email:",
        user.email
    );


if (email === null) return;


const role = prompt(
    "Enter role:\nAdmin\nDoctor\nReceptionist\nLab Technician\nPharmacist",
    user.role
);
if (role === null) return;


const username =
    prompt(
        "Enter login username:",
        user.username || ""
    );


if (username === null) return;

const newPassword = prompt("New password (leave blank to keep current):", "");
if (newPassword === null) return;

const nextName = name.trim();
const nextEmail = email.trim();
const nextUsername = username.trim().toLowerCase();
const nextRole = role.trim();
const allowedRoles = ["Admin", "Doctor", "Receptionist", "Lab Technician", "Pharmacist"];

if (!nextName || !nextEmail || !nextUsername || !allowedRoles.includes(nextRole)) {
    alert("Name, email, username, and a valid role are required.");
    return;
}

if (newPassword && newPassword.length < 8) {
    alert("The password must be at least 8 characters.");
    return;
}

const reservedUsernames = [
    "admin"
];
const usernameInUse = reservedUsernames.includes(nextUsername) || users.some(function (item) {
    return item.id !== id && item.username && item.username.toLowerCase() === nextUsername;
});
const emailInUse = users.some(function (item) {
    return item.id !== id && item.email.toLowerCase() === nextEmail.toLowerCase();
});

if (usernameInUse || emailInUse) {
    alert("That username or email is already in use.");
    return;
}

let profile = null;
let profileType = null;

if (nextRole === "Doctor") {
    profile = getDoctors().find(function (doctor) {
        return doctor.email.toLowerCase() === nextEmail.toLowerCase();
    });
    profileType = "doctor";
} else if (nextRole !== "Admin") {
    profile = getStaff().find(function (person) {
        return person.email.toLowerCase() === nextEmail.toLowerCase() && person.role === nextRole;
    });
    profileType = "staff";
}

if (nextRole !== "Admin" && !profile) {
    alert("Add this person to the matching staff or doctor directory before assigning this role.");
    return;
}

if (profile && profile.status !== "Active") {
    alert("Activate this staff or doctor profile before assigning this account.");
    return;
}


user.name = nextName;
user.email = nextEmail;
user.username = nextUsername;
if (newPassword) user.password = newPassword;
user.role = nextRole;
user.profileId = profile ? profile.id : null;
user.profileType = profileType;


saveUsers(users);

if (user.profileType === "doctor") {
    const doctors = getDoctors();
    const doctor = doctors.find(function (item) {
        return item.id === user.profileId;
    });
    if (doctor) {
        doctor.name = nextName;
        doctor.email = nextEmail;
        saveDoctors(doctors);
        syncDoctorStaffRecord(doctor);
    }
} else if (user.profileType === "staff") {
    const staff = getStaff();
    const person = staff.find(function (item) {
        return item.id === user.profileId;
    });
    if (person) {
        person.name = nextName;
        person.email = nextEmail;
        saveStaff(staff);
        if (person.role === "Doctor") {
            syncDoctorProfileFromStaff(person, person.specialization || "");
        } else {
            syncLinkedAccounts("staff", person.id, {
                name: nextName,
                email: nextEmail
            });
        }
    }
}


alert(
    "User updated successfully."
);


loadUsers();

}

// DELETE USER

function deleteUser(id) {

const confirmDelete =
    confirm(
        "Are you sure you want to delete this user?"
    );


if (!confirmDelete) {

    return;

}


deleteById(
    STORAGE_KEYS.users,
    id
);


alert(
    "User deleted successfully."
);


loadUsers();

}

// TOGGLE USER STATUS

function toggleUserStatus(id) {

const users = getUsers();


const user =
    users.find(function (item) {

        return item.id === id;

    });


if (!user) {

    return;

}


user.status =
    user.status === "Active"
        ? "Inactive"
        : "Active";


saveUsers(users);


loadUsers();

}

// SEARCH USERS

function searchUsers() {

const search =
    document.getElementById(
        "userSearch"
    ).value
    .toLowerCase()
    .trim();


const users = getUsers();


const filteredUsers =
    users.filter(function (user) {

        return (

            user.name
                .toLowerCase()
                .includes(search)

            ||

            user.email
                .toLowerCase()
                .includes(search)

            ||

            (user.username || "")
                .toLowerCase()
                .includes(search)

            ||

            user.role
                .toLowerCase()
                .includes(search)

        );

    });


displayUsers(
    filteredUsers
);

}

// DISPLAY USERS

function displayUsers(users) {

const tableBody =
    document.getElementById(
        "userTableBody"
    );


if (!tableBody) return;


tableBody.innerHTML = "";


if (users.length === 0) {

    tableBody.innerHTML = `

        <tr>

            <td colspan="7">
                No users found.
            </td>

        </tr>

    `;

    return;

}


users.forEach(function (user) {

    const row =
        document.createElement("tr");


    row.innerHTML = `

        <td>${user.id}</td>

        <td>${user.name}</td>

        <td>${user.email}</td>

        <td>${user.username || "-"}</td>

        <td>${user.role}</td>

        <td>${user.status}</td>

        <td>

            <button
                onclick="editUser('${user.id}')">
                Edit
            </button>

            <button
                onclick="toggleUserStatus('${user.id}')">
                ${
                    user.status === "Active"
                    ? "Deactivate"
                    : "Activate"
                }
            </button>

            <button
                onclick="deleteUser('${user.id}')">
                Delete
            </button>

        </td>

    `;


    tableBody.appendChild(row);

});

}

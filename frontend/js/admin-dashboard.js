let loggedInUser = null;

try {
    loggedInUser = JSON.parse(localStorage.getItem('loggedInUser') || 'null');
} catch (error) {
    localStorage.removeItem('loggedInUser');
}

if (!loggedInUser || loggedInUser.role !== 'admin') {
    window.location.replace('../index.html');
} else {
    document.getElementById('sign-in-link').addEventListener('click', () => {
        localStorage.removeItem('loggedInUser');
        localStorage.removeItem('fd_access');
        localStorage.removeItem('fd_refresh');
        localStorage.removeItem('fd_name');
    });

document.addEventListener('DOMContentLoaded', () => {
    const doctors = getDoctors();
    const staff = getStaff();
    const users = getUsers();

    document.getElementById('totalDoctors').textContent = doctors.length;
    document.getElementById('totalStaff').textContent = staff.length;
    document.getElementById('totalUsers').textContent = users.length;
    document.getElementById('activeUsers').textContent = users.filter(user => user.status === 'Active').length;
});
}
// ==========================================================
// 1. CONFIGURACIÓN DE SUPABASE (¡REEMPLAZA CON TUS PROPIAS KEYS!)
// ==========================================================
const SUPABASE_URL = 'https://ksbdwfaymmooclqymaij.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtzYmR3ZmF5bW1vb2NscXltYWlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzMjUzNTksImV4cCI6MjA3ODkwMTM1OX0.VL5UTv_zVdZLnJO8lbQc2is_Y3neKnYHGzh21B70ow4U'; 

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUserId = null; 
let currentUserIsAdmin = false;

// ==========================================================
// 2. LÓGICA DEL CARGADOR (LOADER)
// ==========================================================
function hideLoader() {
    const loader = document.getElementById('page-loader');
    if (loader) loader.style.display = 'none'; 
}


// ==========================================================
// 3. FUNCIONES DE AUTENTICACIÓN Y ROLES
// ==========================================================

async function checkUserAndLoadContent() {
    const { data: { user } } = await supabase.auth.getUser();
    currentUserId = user ? user.id : null;
    currentUserIsAdmin = false; // Resetear el estado de admin
    
    const path = window.location.pathname;
    
    const authBtn = document.getElementById('header-auth-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const authSection = document.getElementById('auth-section');
    const homeContent = document.getElementById('home-content'); 

    // Resetear visibilidad en index.html
    if (authSection) authSection.style.display = 'none';
    if (homeContent) homeContent.style.display = 'none';
    
    // Ocultar siempre el dashboard de admin al inicio
    const adminDashboard = document.getElementById('admin-dashboard');
    if (adminDashboard) adminDashboard.style.display = 'none';


    if (user) {
        // --- A. Usuario LOGUEADO ---
        if (authBtn) { 
            // Mostrar solo el nombre de usuario (parte antes del @)
            authBtn.textContent = user.email.split('@')[0];
        }
        if (logoutBtn) logoutBtn.style.display = 'block';
        
        // Cargar perfil para verificar si es admin
        const { data: profile } = await supabase.from('members').select('is_admin').eq('id', user.id).single();
        if (profile) {
            currentUserIsAdmin = profile.is_admin;
        }

        // Mostrar contenido principal en index.html
        if (path.includes('index.html') || path === '/') {
            if (homeContent) homeContent.style.display = 'block';
        }

        // Lógica de carga y Admin Dashboard
        if (path.includes('cursos.html') || path.includes('diplomaturas.html')) {
            const isCoursesPage = path.includes('cursos.html');
            // Si es cursos.html, carga cursos. Si es diplomaturas.html, carga diplomaturas.
            const category = isCoursesPage ? 'curso' : 'diplomatura';

            loadCourses(category); 
            
            if (currentUserIsAdmin) {
                // El dashboard completo (gestión de cursos y registros) solo se muestra en cursos.html
                if (isCoursesPage && adminDashboard) {
                    adminDashboard.style.display = 'block';
                    loadAdminCourseList(); 
                    loadRegistrations(); // REQUISITO CLAVE: Cargar los registros para el admin
                }
            }
        }
        
        // Precargar formulario de registro si estamos en register.html
        if (path.includes('register.html')) {
            prefillRegistrationForm();
        }

    } else {
        // --- B. Usuario NO LOGUEADO (Público/Acceso) ---
        if (authBtn) { 
            authBtn.textContent = 'Acceso';
        }
        if (logoutBtn) logoutBtn.style.display = 'none';

        // En la página de inicio (NO LOGUEADO), se muestra el contenido principal.
        if (path.includes('index.html') || path === '/') {
            if (homeContent) homeContent.style.display = 'block'; 
        }
        
        // Cargar cursos/diplomaturas para el público
        if (path.includes('cursos.html')) loadCourses('curso');
        if (path.includes('diplomaturas.html')) loadCourses('diplomatura');

        // Si intenta acceder a register.html sin estar logueado, precargar sin email de usuario
        if (path.includes('register.html')) {
            prefillRegistrationForm();
        }
    }

    hideLoader(); 
}

// ==========================================================
// 4. FUNCIONES PÚBLICAS (Ver cursos y registrarse)
// ==========================================================

// REQUISITO CLAVE: Ver Cursos/Diplomaturas
async function loadCourses(category) {
    const coursesGrid = document.getElementById(`dynamic-${category}s`);
    if (!coursesGrid) return;
    
    // Obtener solo los cursos/diplomaturas activos
    const { data: courses, error } = await supabase
        .from('courses')
        .select('*')
        .eq('category', category)
        .eq('is_active', true) 
        .order('id', { ascending: true });

    if (error) {
        coursesGrid.innerHTML = `<p style="color:red;">Error al cargar ${category}s: ${error.message}</p>`;
        return;
    }

    coursesGrid.innerHTML = '';
    
    if (courses.length === 0) {
         coursesGrid.innerHTML = `<p>No hay ${category}s activos disponibles en este momento.</p>`;
    }

    courses.forEach(course => {
        const card = document.createElement('div');
        card.className = 'course-card';
        // Usamos el enlace a register.html con el course_id para la inscripción
        const descriptionSnippet = course.description ? course.description.substring(0, 100) + (course.description.length > 100 ? '...' : '') : 'Sin descripción.';

        card.innerHTML = `
            <img src="${course.image_url || 'Imagenes/default.jpg'}" alt="${course.title}">
            <div class="course-info">
                <h3>${course.title}</h3>
                <p>${descriptionSnippet}</p>
                <a href="register.html?course_id=${course.id}" class="course-button">Inscribirme</a>
            </div>
        `;
        coursesGrid.appendChild(card);
    });
}

async function prefillRegistrationForm() {
    const params = new URLSearchParams(window.location.search);
    const courseId = params.get('course_id');
    const courseTitleEl = document.getElementById('course-title-register');
    const courseIdInput = document.getElementById('course-id-input');
    const regEmail = document.getElementById('reg-email');
    
    if (courseId) {
        const { data: course, error } = await supabase.from('courses').select('title').eq('id', courseId).single();
        if (course && courseTitleEl) {
            courseTitleEl.textContent = `Inscripción a: ${course.title}`;
            courseIdInput.value = courseId;
        } else {
            if(courseTitleEl) courseTitleEl.textContent = 'Error: Curso no encontrado.';
            courseIdInput.value = '';
        }
    } else {
        if(courseTitleEl) courseTitleEl.textContent = 'Inscripción General';
    }


    const { data: { user } } = await supabase.auth.getUser();
    if (user && regEmail) {
        regEmail.value = user.email;
        regEmail.readOnly = true; 
    } else {
        if (regEmail) regEmail.readOnly = false;
    }
}

// REQUISITO CLAVE: Registrarse a los cursos
async function handleRegistration(e) {
    e.preventDefault();
    const courseId = document.getElementById('course-id-input').value;
    const firstName = document.getElementById('reg-name').value;
    const lastName = document.getElementById('reg-lastname').value;
    const documentNumber = document.getElementById('reg-document').value;
    const email = document.getElementById('reg-email').value;
    const phone = document.getElementById('reg-phone').value;
    const city = document.getElementById('reg-city').value;
    const regMessage = document.getElementById('reg-message');

    if (!courseId) {
        regMessage.textContent = 'Error: No se seleccionó un curso válido.';
        regMessage.style.color = 'red';
        return;
    }
    
    if (regMessage) {
        regMessage.textContent = 'Procesando inscripción...';
        regMessage.style.color = '#0055aa';
    }

    const { error } = await supabase
        .from('registrations')
        .insert({
            course_id: courseId,
            user_id: currentUserId,
            first_name: firstName,
            last_name: lastName,
            document_number: documentNumber,
            email: email,
            phone_number: phone,
            city: city
        });

    if (regMessage) {
        if (error) {
            if (error.code === '23505') { 
                // Código de error de duplicado (Unique constraint violation)
                regMessage.textContent = '¡Ya existe una inscripción a este curso con este DNI!';
            } else {
                regMessage.textContent = `Error al inscribirse: ${error.message}`;
            }
            regMessage.style.color = 'red';
        } else {
            regMessage.textContent = '🎉 ¡Inscripción exitosa! Recibirás un email de confirmación.';
            regMessage.style.color = 'green';
            document.getElementById('registration-form').reset();
            // Mantener el courseId y el email si estaba precargado
            document.getElementById('course-id-input').value = courseId;
            prefillRegistrationForm();
        }
    }
}

// ==========================================================
// 5. FUNCIONES DE ADMINISTRACIÓN (CRUD y Reportes)
// ==========================================================

// REQUISITO CLAVE: Admin ver registros (Reporte de Inscripciones)
async function loadRegistrations() {
    const tbody = document.getElementById('registrations-tbody');
    if (!tbody) return;

    // Join con la tabla courses para obtener el título
    const { data: registrations, error } = await supabase
        .from('registrations')
        .select(`
            id, document_number, first_name, last_name, email, phone_number, city, registered_at,
            course:courses ( title )
        `)
        .order('registered_at', { ascending: false });

    if (error) {
        tbody.innerHTML = `<tr><td colspan="7" style="color:red;">Error al cargar registros: ${error.message}</td></tr>`;
        return;
    }

    tbody.innerHTML = '';
    
    if (registrations.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7">No hay registros de inscripción aún.</td></tr>`;
        return;
    }

    registrations.forEach(reg => {
        const row = tbody.insertRow();
        const courseTitle = reg.course ? reg.course.title : 'N/A';
        
        row.insertCell().textContent = courseTitle;
        row.insertCell().textContent = `${reg.first_name} ${reg.last_name}`;
        row.insertCell().textContent = reg.document_number;
        row.insertCell().textContent = reg.email;
        row.insertCell().textContent = reg.phone_number || '-'; // Mostrar '-' si no hay teléfono
        row.insertCell().textContent = reg.city || '-'; // Mostrar '-' si no hay ciudad
        // Formatear la fecha
        const date = new Date(reg.registered_at);
        row.insertCell().textContent = date.toLocaleDateString('es-AR') + ' ' + date.toLocaleTimeString('es-AR');
    });
}

// Admin: Cargar lista de cursos para edición
async function loadAdminCourseList() {
    const tbody = document.getElementById('admin-courses-tbody');
    if (!tbody) return;

    const { data: courses, error } = await supabase
        .from('courses')
        .select('*')
        .order('id', { ascending: true });

    if (error) {
        tbody.innerHTML = `<tr><td colspan="5" style="color:red;">Error al cargar cursos para administración: ${error.message}</td></tr>`;
        return;
    }

    tbody.innerHTML = '';
    
    courses.forEach(course => {
        const row = tbody.insertRow();
        row.insertCell().textContent = course.id;
        row.insertCell().textContent = course.title;
        row.insertCell().textContent = course.category;
        row.insertCell().textContent = course.is_active ? 'Sí' : 'No';
        
        const actionsCell = row.insertCell();
        
        const editBtn = document.createElement('button');
        editBtn.textContent = 'Editar';
        editBtn.className = 'course-button small-btn edit-btn';
        editBtn.addEventListener('click', () => openEditForm(course));

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Eliminar';
        deleteBtn.className = 'course-button small-btn delete-btn';
        deleteBtn.addEventListener('click', () => deleteCourse(course.id));

        actionsCell.appendChild(editBtn);
        actionsCell.appendChild(deleteBtn);
    });
}

// Admin: Abrir formulario para editar un curso
function openEditForm(course) {
    const form = document.getElementById('course-form');
    const formTitle = document.getElementById('course-form-title');
    const addCourseSection = document.getElementById('add-course-section');

    if (!form || !formTitle || !addCourseSection) return;

    formTitle.textContent = `Editar: ${course.title}`;
    document.getElementById('course-id-input-admin').value = course.id;
    document.getElementById('course-title').value = course.title;
    document.getElementById('course-description').value = course.description;
    document.getElementById('course-image').value = course.image_url;
    document.getElementById('course-category').value = course.category;
    document.getElementById('course-active').checked = course.is_active;
    
    addCourseSection.style.display = 'block'; 
    // Scroll suave al formulario de edición
    window.scrollTo({ top: addCourseSection.offsetTop - 100, behavior: 'smooth' });
}

// Admin: Eliminar un curso
async function deleteCourse(courseId) {
    if (!confirm('¿Estás seguro de que quieres ELIMINAR este curso? Esta acción es irreversible.')) {
        return;
    }

    const { error } = await supabase
        .from('courses')
        .delete()
        .eq('id', courseId);

    if (error) {
        alert('Error al eliminar el curso: ' + error.message);
    } else {
        alert('Curso eliminado con éxito.');
        // Recargar listas
        loadAdminCourseList(); 
        if (window.location.pathname.includes('cursos.html')) loadCourses('curso');
        if (window.location.pathname.includes('diplomaturas.html')) loadCourses('diplomatura');
    }
}

// Admin: Manejar el envío del formulario de creación/edición de cursos
async function handleCourseFormSubmit(e) {
    e.preventDefault();
    
    const courseId = document.getElementById('course-id-input-admin').value;
    const title = document.getElementById('course-title').value;
    const description = document.getElementById('course-description').value;
    const imageUrl = document.getElementById('course-image').value;
    const category = document.getElementById('course-category').value;
    const isActive = document.getElementById('course-active').checked;
    
    let dbOperation;

    if (courseId) {
        // Editar
        dbOperation = supabase
            .from('courses')
            .update({ title, description, image_url: imageUrl, category, is_active: isActive }) 
            .eq('id', courseId);
    } else {
        // Crear
        dbOperation = supabase
            .from('courses')
            .insert({ title, description, image_url: imageUrl, category, is_active: isActive });
    }

    const { error } = await dbOperation;

    if (error) {
        alert('Error al guardar el curso: ' + error.message);
    } else {
        alert(`¡Curso ${courseId ? 'actualizado' : 'guardado'} con éxito!`);
        // Resetear formulario
        document.getElementById('course-form-title').textContent = 'Crear Nuevo Curso';
        document.getElementById('course-form').reset();
        document.getElementById('course-id-input-admin').value = '';
        
        // Recargar listas
        loadAdminCourseList(); 
        if (window.location.pathname.includes('cursos.html')) loadCourses('curso');
        if (window.location.pathname.includes('diplomaturas.html')) loadCourses('diplomatura');
    }
}


// ==========================================================
// 6. EVENT LISTENERS Y FLUJO DE ACCESO
// ==========================================================

// Función para mostrar el formulario de login y actualizar el título
function showLoginForm(role) {
    const roleSelection = document.getElementById('role-selection');
    const loginContainer = document.getElementById('login-container');
    const loginFormTitle = document.getElementById('login-form-title');
    const signupContainer = document.getElementById('signup-container');
    const authError = document.getElementById('auth-error');
    
    if (authError) authError.textContent = ''; 
    
    if (roleSelection && loginContainer && loginFormTitle) {
        roleSelection.style.display = 'none';
        loginContainer.style.display = 'block';
        if (signupContainer) signupContainer.style.display = 'none';
        
        if (role === 'admin') {
            loginFormTitle.textContent = 'Acceso de Administrador';
            // Los administradores no se registran por la UI pública
            document.getElementById('show-signup').style.display = 'none'; 
        } else {
            loginFormTitle.textContent = 'Acceso de Estudiante';
            document.getElementById('show-signup').style.display = 'block';
        }
    }
}

// Función para volver a la selección de rol
function showRoleSelection() {
    const roleSelection = document.getElementById('role-selection');
    const loginContainer = document.getElementById('login-container');
    const signupContainer = document.getElementById('signup-container');
    const authError = document.getElementById('auth-error');
    
    if (roleSelection) {
        roleSelection.style.display = 'block';
        if (loginContainer) loginContainer.style.display = 'none';
        if (signupContainer) signupContainer.style.display = 'none';
        if (authError) authError.textContent = ''; 
    }
}


document.addEventListener('DOMContentLoaded', () => {
    // Escuchar cambios de estado de autenticación (login/logout)
    supabase.auth.onAuthStateChange(() => {
        checkUserAndLoadContent();
    });

    checkUserAndLoadContent(); // Comprobación inicial

    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const authError = document.getElementById('auth-error');
    const authBtn = document.getElementById('header-auth-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const authSection = document.getElementById('auth-section');
    const homeContent = document.getElementById('home-content');
    
    // --- Lógica de Selección de Rol ---
    const showStudentLoginBtn = document.getElementById('show-student-login');
    const showAdminLoginBtn = document.getElementById('show-admin-login');
    const backToSelectionBtn = document.getElementById('back-to-selection');
    const loginContainer = document.getElementById('login-container');
    const signupContainer = document.getElementById('signup-container');
    
    if (showStudentLoginBtn) showStudentLoginBtn.addEventListener('click', () => showLoginForm('student'));
    if (showAdminLoginBtn) showAdminLoginBtn.addEventListener('click', () => showLoginForm('admin'));
    if (backToSelectionBtn) backToSelectionBtn.addEventListener('click', showRoleSelection);

    // Lógica para ALTERNAR entre la vista de contenido principal y la de acceso en index.html
    if (authBtn) {
        authBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const path = window.location.pathname;
            
            if (path.includes('index.html') || path === '/') {
                if (authSection && homeContent) {
                    if (authSection.style.display === 'block') {
                        // Ocultar Auth y mostrar Home
                        authSection.style.display = 'none';
                        homeContent.style.display = 'block';
                        showRoleSelection(); 
                    } else {
                        // Mostrar Auth y ocultar Home
                        authSection.style.display = 'block';
                        homeContent.style.display = 'none';
                        showRoleSelection();
                    }
                }
            } else if (path.includes('register.html') && currentUserId) {
                 // Si está en register.html y logueado, el botón no hace nada.
                 return;
            } else {
                // Si está en otra página, redirigir a la home para loguearse
                window.location.href = 'index.html#auth';
            }
        });
    }

    // Manejo de Login
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = loginForm['login-email'].value;
            const password = loginForm['login-password'].value;
            const { error } = await supabase.auth.signInWithPassword({ email, password });

            if (authError) {
                if (error) {
                    authError.textContent = 'Error: ' + error.message;
                } else {
                    authError.textContent = '¡Sesión iniciada con éxito! Recargando página...';
                    window.location.reload(); 
                }
            }
        });
    }

    // Manejo de Registro (Solo para Estudiantes)
    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = signupForm['signup-email'].value;
            const password = signupForm['signup-password'].value;
            const { error, data } = await supabase.auth.signUp({ email, password });

            if (authError) {
                if (error) {
                    authError.textContent = 'Error de registro: ' + error.message;
                } else {
                    if (data.user) {
                        // Insertar en la tabla members como NO administrador por defecto
                        await supabase.from('members').insert([
                            { id: data.user.id, email: email, is_admin: false }
                        ]);
                    }

                    authError.textContent = '¡Registro exitoso! Revisa tu email para confirmar y luego inicia sesión.';
                    if (signupContainer) signupContainer.style.display = 'none';
                    if (loginContainer) loginContainer.style.display = 'block';
                    document.getElementById('login-form-title').textContent = 'Acceso de Estudiante';
                    document.getElementById('show-signup').style.display = 'block';
                }
            }
        });
    }

    // Manejo de Logout
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await supabase.auth.signOut();
            checkUserAndLoadContent();
            window.location.reload(); 
        });
    }

    // Lógica de alternar formularios Login/Signup
    const showSignupBtn = document.getElementById('show-signup');
    const showLoginBtn = document.getElementById('show-login');
    if (showSignupBtn && loginContainer && signupContainer) showSignupBtn.addEventListener('click', (e) => { e.preventDefault(); loginContainer.style.display = 'none'; signupContainer.style.display = 'block'; if (authError) authError.textContent = ''; });
    if (showLoginBtn && loginContainer && signupContainer) showLoginBtn.addEventListener('click', (e) => { e.preventDefault(); loginContainer.style.display = 'block'; signupContainer.style.display = 'none'; if (authError) authError.textContent = ''; });

    // Manejo de Inscripción (REQUISITO CLAVE)
    const registrationForm = document.getElementById('registration-form');
    if (registrationForm) {
        registrationForm.addEventListener('submit', handleRegistration);
    }

    // Manejo de CRUD de Admin
    const addCourseBtn = document.getElementById('add-course-btn');
    const courseForm = document.getElementById('course-form');
    
    if (addCourseBtn) {
        addCourseBtn.addEventListener('click', () => {
            const addCourseSection = document.getElementById('add-course-section');
            if(addCourseSection) {
                // Resetear y mostrar el formulario
                document.getElementById('course-form-title').textContent = 'Crear Nuevo Curso';
                document.getElementById('course-form').reset();
                document.getElementById('course-id-input-admin').value = '';
                document.getElementById('course-active').checked = true; 
                addCourseSection.style.display = addCourseSection.style.display === 'block' ? 'none' : 'block';
            }
        });
    }

    if (courseForm) {
        courseForm.addEventListener('submit', handleCourseFormSubmit);
    }
});
const { getToken, setToken, api, HOME_PATH } = window.Manager;

const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");

if (getToken()) {
  location.replace(HOME_PATH);
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginError.textContent = "";

  try {
    const data = await api("/login", {
      method: "POST",
      toast: false,
      body: JSON.stringify({
        username: loginForm.username.value,
        password: loginForm.password.value,
      }),
    });
    setToken(data.token);
    location.replace(HOME_PATH);
  } catch (error) {
    loginError.textContent = error.message;
  }
});

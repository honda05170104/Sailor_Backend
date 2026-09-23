const { getToken, setToken, api, HOME_PATH, showToast } = window.Manager;

const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");

if (getToken()) {
  location.replace(HOME_PATH);
}

function loginErrorMessage(message) {
  if (!message || message === "Request failed") return "登入失敗";
  if (message === "Invalid username or password") return "帳號或密碼錯誤";
  if (message === "username is required") return "請輸入帳號";
  if (message === "password is required") return "請輸入密碼";
  return message;
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
    const message = loginErrorMessage(error.message);
    loginError.textContent = message;
    showToast(message, "error");
  }
});

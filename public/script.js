// ----------------- Notiflix Config -----------------
Notiflix.Notify.init({
    width: "320px",
    position: "right-top",
    distance: "12px",
    opacity: 1,
    borderRadius: "8px",
    fontSize: "15px",
    timeout: 3000,
    success: { background: "#34db6c", textColor: "#fff" },
    failure: { background: "#e74c3c", textColor: "#fff" },
    warning: { background: "#f39c12", textColor: "#fff" },
    info: { background: "#5dade2", textColor: "#fff" },
});

Notiflix.Loading.init({
    svgColor: "#3498db",
    messageColor: "#3498db",
    backgroundColor: "rgba(255,255,255,0.8)",
    svgSize: "60px",
    fontSize: "16px",
    fontFamily: "Arial, sans-serif",
});

Notiflix.Confirm.init({
    borderRadius: "10px",
    titleColor: "#2c3e50",
    messageColor: "#34495e",
    okButtonBackground: "#3498db",
    okButtonColor: "#fff",
    cancelButtonBackground: "#e74c3c",
    cancelButtonColor: "#fff",
});

// ----------------- Button handlers -----------------
const insertBtn = document.getElementById("insertBtn");
const showBtn = document.getElementById("showBtn");
const contentContainer = document.getElementById("contentContainer");

// Load HTML dynamically
async function loadHTML(file) {
    Notiflix.Loading.standard("Loading...");
    try {
        const res = await fetch(file);
        const html = await res.text();
        contentContainer.innerHTML = `<div class="loaded-content">${html}</div>`;

        // Execute scripts inside loaded HTML
        const scripts = contentContainer.querySelectorAll("script");
        scripts.forEach(oldScript => {
            const newScript = document.createElement("script");
            if (oldScript.src) newScript.src = oldScript.src;
            else newScript.textContent = oldScript.textContent;
            document.body.appendChild(newScript);
        });

        if (file === "transaction.html") initTransactionForm();
        if (file === "show_data.html") fetchAndRenderDataWithPassword();
    } catch (err) {
        Notiflix.Notify.failure("⚠️ Unable to load page!");
        console.error(err);
    } finally {
        Notiflix.Loading.remove();
    }
}

insertBtn.addEventListener("click", () => loadHTML("transaction.html"));
showBtn.addEventListener("click", () => loadHTML("show_data.html"));

// ----------------- Transaction Form Handler -----------------
function initTransactionForm() {
    const nameInput = document.getElementById("name");
    const priceInput = document.getElementById("price");
    const shopNameInput = document.getElementById("shopName");
    const typeInput = document.getElementById("type");
    const dateInput = document.getElementById("date");
    const submitBtn = document.getElementById("submitBtn");
    const formBox = document.getElementById("formBox");

    formBox.classList.add("animate");
    const elements = formBox.querySelectorAll("h2,input,select,button");
    elements.forEach(el => el.classList.add("animate"));

    if (dateInput.showPicker) dateInput.addEventListener("click", () => dateInput.showPicker());

    priceInput.addEventListener("input", () => {
        priceInput.value = priceInput.value.replace(/[^0-9.]/g, "");
    });

    submitBtn.addEventListener("click", async () => {
        const name = nameInput.value.trim();
        const shop = shopNameInput.value.trim();
        const price = priceInput.value.trim();
        const type = typeInput.value.trim();
        const date = dateInput.value.trim();
        const today = new Date().toISOString().split("T")[0];

        if (!name || !shop || !price || !type || !date) {
            Notiflix.Notify.failure("All fields are required!");
            return;
        }
        if (date > today) {
            Notiflix.Notify.failure("Enter a valid date");
            return;
        }

        const selectedDate = new Date(date);
        const formattedDate = `${String(selectedDate.getDate()).padStart(2,"0")}/${
            String(selectedDate.getMonth()+1).padStart(2,"0")}/${selectedDate.getFullYear()}`;

        Notiflix.Confirm.prompt(
            "🔒 Password Required",
            "Enter password:",
            "",
            "Submit",
            "Cancel",
            async (enteredPassword) => {
                Notiflix.Loading.standard("Submitting...");
                try {
                    const res = await fetch("/submit", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            name,
                            shopName: shop,
                            price: "Rs. " + price,
                            type,
                            date: formattedDate,
                            password: enteredPassword
                        })
                    });
                    const data = await res.json();
                    Notiflix.Loading.remove();

                    if (data.success) {
                        Notiflix.Notify.success("✅ Data inserted successfully!");
                        nameInput.value = shopNameInput.value = priceInput.value = typeInput.value = dateInput.value = "";
                        nameInput.focus();
                        formBox.classList.add("success-reset");
                        setTimeout(()=> formBox.classList.remove("success-reset"), 1000);
                    } else if (data.error === "invalid_password") {
                        Notiflix.Notify.failure("❌ Wrong password!");
                    } else {
                        Notiflix.Notify.failure("⚠️ Insertion failed, try again.");
                    }
                } catch {
                    Notiflix.Loading.remove();
                    Notiflix.Notify.failure("⚠️ API not working!");
                }
            },
            () => {}
        );
    });
}

// ----------------- Show Data with Password (Responsive) -----------------
function fetchAndRenderDataWithPassword() {
    Notiflix.Confirm.prompt(
        "🔒 Password Required",
        "Enter password to view data:",
        "",
        "Submit",
        "Cancel",
        async (enteredPassword) => {
            Notiflix.Loading.standard("Loading data...");
            try {
                const res = await fetch(`/data?password=${encodeURIComponent(enteredPassword)}`);
                const data = await res.json();
                Notiflix.Loading.remove();

                if (data.error === "invalid_password") {
                    Notiflix.Notify.failure("❌ Wrong password!");
                    contentContainer.innerHTML = "";
                    return;
                }

                const headers = ["Name", "Price", "Shop Name", "Type", "Txn_Date", "Timestamp"];

                // Wrap the table for scroll
                contentContainer.innerHTML = `
                    <div class="sheet-table-wrapper">
                        <table class="sheet-table">
                            <thead>
                                <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
                            </thead>
                            <tbody></tbody>
                        </table>
                    </div>
                `;

                const tbody = contentContainer.querySelector("tbody");

                // Check if table has data
                if (!data.values || data.values.length <= 1) {
                    tbody.innerHTML = `
                        <tr>
                            <td colspan="${headers.length}" style="text-align:center; padding:20px; color:#999;">
                                🕳️ Table is empty
                            </td>
                        </tr>`;
                    return;
                }

                // Render rows dynamically
                data.values.slice(1).forEach((row, index) => {
                    const tr = document.createElement("tr");

                    row.forEach((cell, i) => {
                        const td = document.createElement("td");
                        td.setAttribute("data-label", headers[i]);
                        td.textContent = cell;
                        tr.appendChild(td);
                    });

                    tbody.appendChild(tr);

                    // Fade-in animation
                    setTimeout(() => tr.classList.add("show"), index * 100);
                });

            } catch (err) {
                Notiflix.Loading.remove();
                Notiflix.Notify.failure("⚠️ Unable to fetch data!");
                console.error(err);
                contentContainer.innerHTML = `
                    <div class="sheet-table-wrapper">
                        <table class="sheet-table">
                            <tr>
                                <td colspan="6" style="text-align:center; padding:20px; color:#999;">
                                    ⚠️ Unable to load data
                                </td>
                            </tr>
                        </table>
                    </div>`;
            }
        },
        () => {}
    );
}

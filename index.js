
document.getElementById("create").onclick = async () => {
    const tg_id = prompt("Введите свой TG ID:");
    const resp = await fetch(`https://otzoviktg.ru/create_hub?creator_tg_id=${tg_id}`, {
            method: "POST"
        });
    const data = await resp.json();
    const entry_id = data.info.entry_id;
    window.location.href = `kinolenta/room.html?entry_id=${entry_id}&is_main=true&tg_id=${tg_id}`;
};

document.getElementById("join").onclick = async () => {
    const entry_id = document.getElementById("entry_id_input").value.trim();
    const tg_id = prompt("Введите свой TG ID:");
    await fetch(`https://otzoviktg.ru/join_hub?tg_id=${tg_id}&entry_id=${entry_id}`);
    window.location.href = `kinolenta/room.html?entry_id=${entry_id}&is_main=false&tg_id=${tg_id}`;
};

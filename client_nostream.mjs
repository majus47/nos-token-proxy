import axios from "axios";

const main = async () => {
    return await axios({
        method: "POST",
        url: "http://localhost:4015/nos-proxy/chat/completions",
        headers: {
            authorization: `asd`,
        },
        data: {
            model: "moonshotai/kimi-k2:free",
            messages: [
            {
                role: "user",
                content: "What is the meaning of life?",
            },
            ],
        },
        });
};

main().then( d => console.log(d.data));



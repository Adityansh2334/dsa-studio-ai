import { toast } from "react-hot-toast";

export const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    if (type === "success") toast.success(message);
    else if (type === "error") toast.error(message);
    else toast(message);
};

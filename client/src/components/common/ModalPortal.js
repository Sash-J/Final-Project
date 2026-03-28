import { useEffect } from "react";
import ReactDOM from "react-dom";

const ModalPortal = ({ children }) => {
  const modalRoot = document.getElementById("modal-root");
  
  // Body scroll lock
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, []);

  if (!modalRoot) return children;
  return ReactDOM.createPortal(children, modalRoot);
};

export default ModalPortal;

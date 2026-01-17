type ConfirmModalProps = {
  open: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

export default function ConfirmModal({
  open,
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  if (!open) return null;

  return (
    <div className="modal">
      <div className="modal-content confirm-modal">
        <h2>Are you sure?</h2>

        <div className="btn-row">
          <button
            type="button"
            className="neg-btn"
            onClick={onConfirm}
          >
            Confirm
          </button>

          <button
            type="button"
            className="pos-btn"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

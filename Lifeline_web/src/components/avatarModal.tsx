type AvatarModalProps = {
  open: boolean;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClose: () => void;
};

const avatars = [
  "alien", "avocado", "bear", "cactus", "cloud",
  "coffee", "face", "pencil", "sheep", "sloth",
];

export default function AvatarModal({
  open,
  value,
  onChange,
  onClose,
}: AvatarModalProps) {
  if (!open) return null;

  return (
    <div className="modal">
      <div className="modal-content">
        <div className="relative">
            <h3 className="info-label">Select Avatar</h3>
            <img src="/images/close.svg" alt="Back" onClick={onClose} className="absolute-right"/>
        </div>

        <div className="avatar-grid">
            {avatars.map((avatar) => {
                const path = `public/avatars/${avatar}.svg`;

                return (
                    <label key={avatar}  className={`avatar-choice ${value === path ? "selected" : ""}`}>
                        <input
                        type="radio"
                        name="image"
                        value={path}
                        checked={value === path}
                        onChange={onChange}
                        />
                        <img src={`/avatars/${avatar}.svg`} className="avatar-img"/>
                    </label>
                );
            })}
        </div>
        <button type="button" className="pos-btn" onClick={onClose}>
            Confirm
        </button>
      </div>
    </div>
  );
}

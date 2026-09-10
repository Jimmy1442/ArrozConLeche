function InputField({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  required = true,
  minLength
}) {
  return (
    <div className="form-group">
      <label>{label}</label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        minLength={minLength}
      />
    </div>
  );
}

export default InputField;
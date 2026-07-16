function initialsFor(user) {
  if (user?.displayName) {
    return user.displayName
      .split(' ')
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase()
  }
  return (user?.email || '?')[0].toUpperCase()
}

export function Avatar({ user, size = 30 }) {
  const style = { width: size, height: size }

  if (user?.photoURL) {
    return <img className="ui-avatar" style={style} src={user.photoURL} alt="" referrerPolicy="no-referrer" />
  }

  return (
    <span className="ui-avatar ui-avatar-initials" style={{ ...style, fontSize: size * 0.4 }}>
      {initialsFor(user)}
    </span>
  )
}

import styles from './Avatar.module.scss'

type AvatarProps = {
  src?: string | null
  firstName: string
  lastName: string
  size?: 'sm' | 'md' | 'lg'
}

export function Avatar({ src, firstName, lastName, size = 'md' }: AvatarProps) {
  const initials = `${firstName.charAt(0).toUpperCase()}${lastName.charAt(0).toUpperCase()}`

  if (src) {
    return (
      <span className={`${styles.avatar} ${styles[size]}`}>
        <img src={src} alt={`${firstName} ${lastName}`} className={styles.image} />
      </span>
    )
  }

  return (
    <span className={`${styles.avatar} ${styles[size]} ${styles.initials}`} title={`${firstName} ${lastName}`}>
      {initials}
    </span>
  )
}

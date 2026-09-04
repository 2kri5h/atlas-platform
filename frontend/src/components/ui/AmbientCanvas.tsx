import { useEffect, useRef } from 'react'
import * as THREE from 'three'

interface AmbientCanvasProps {
  className?: string
}

export default function AmbientCanvas({ className = '' }: AmbientCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // 1. Respect prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion) return

    let animationFrameId: number
    let isVisible = true

    // 2. Setup Three.js Scene, Camera, Renderer
    const scene = new THREE.Scene()
    const width = container.clientWidth || window.innerWidth
    const height = container.clientHeight || window.innerHeight

    const camera = new THREE.PerspectiveCamera(50, width / height, 1, 1000)
    camera.position.set(0, 0, 240)

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'low-power',
    })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
    container.appendChild(renderer.domElement)

    // 3. Theme-aware Material Palette Manager
    const getTheme = () => document.documentElement.getAttribute('data-theme') || 'dark'
    let isLightMode = getTheme() === 'light'

    const palette = {
      light: {
        ringColor: 0x4f46e5,
        ringOpacity: 0.22,
        ringBlending: THREE.NormalBlending,
        coreColor: 0x4338ca,
        coreOpacity: 0.28,
        satelliteColor: 0x312e81,
        satelliteOpacity: 0.5,
        ticksColor: 0x6366f1,
        ticksOpacity: 0.2,
      },
      dark: {
        ringColor: 0x818cf8,
        ringOpacity: 0.5,
        ringBlending: THREE.AdditiveBlending,
        coreColor: 0xc084fc,
        coreOpacity: 0.6,
        satelliteColor: 0xa5b4fc,
        satelliteOpacity: 0.85,
        ticksColor: 0x818cf8,
        ticksOpacity: 0.35,
      },
    }

    const currentPalette = isLightMode ? palette.light : palette.dark

    // 4. Create ATLAS Armillary Astrolabe Hierarchical Assembly
    const astrolabe = new THREE.Group()
    // Position astrolabe dynamically: slightly offset towards the top-right quadrant
    const updateAstrolabePosition = () => {
      const w = container.clientWidth || window.innerWidth
      if (w > 1024) {
        astrolabe.position.set(w * 0.18, 10, 0)
      } else {
        astrolabe.position.set(0, 15, 0)
      }
    }
    updateAstrolabePosition()
    scene.add(astrolabe)

    // Shared Ring Geometries & Materials
    const ringMaterials: THREE.MeshBasicMaterial[] = []
    const createRingMaterial = (color: number, opacity: number, blending: THREE.Blending) => {
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
        blending,
        wireframe: false,
      })
      ringMaterials.push(mat)
      return mat
    }

    // A. Outer Gimbal / Horizon Ring (Radius 98)
    const horizonGeo = new THREE.TorusGeometry(98, 0.65, 12, 100)
    const horizonMat = createRingMaterial(
      currentPalette.ringColor,
      currentPalette.ringOpacity * 0.9,
      currentPalette.ringBlending
    )
    const horizonRing = new THREE.Mesh(horizonGeo, horizonMat)
    astrolabe.add(horizonRing)

    // B. Celestial Meridian Ring (Radius 82, rotated 90° on X)
    const meridianGeo = new THREE.TorusGeometry(82, 0.55, 12, 90)
    const meridianMat = createRingMaterial(
      currentPalette.ringColor,
      currentPalette.ringOpacity,
      currentPalette.ringBlending
    )
    const meridianRing = new THREE.Mesh(meridianGeo, meridianMat)
    meridianRing.rotation.x = Math.PI / 2
    astrolabe.add(meridianRing)

    // C. Ecliptic / Zodiac Ring (Radius 68, true 23.4° axial obliquity + 45° tilt)
    const eclipticGeo = new THREE.TorusGeometry(68, 0.75, 12, 80)
    const eclipticMat = createRingMaterial(
      currentPalette.coreColor,
      currentPalette.ringOpacity * 1.15,
      currentPalette.ringBlending
    )
    const eclipticRing = new THREE.Mesh(eclipticGeo, eclipticMat)
    eclipticRing.rotation.set(0.409, 0.785, 0) // ~23.44° Earth tilt
    astrolabe.add(eclipticRing)

    // D. Polar Coordinate Ring (Radius 52)
    const polarGeo = new THREE.TorusGeometry(52, 0.45, 12, 70)
    const polarMat = createRingMaterial(
      currentPalette.ringColor,
      currentPalette.ringOpacity * 0.75,
      currentPalette.ringBlending
    )
    const polarRing = new THREE.Mesh(polarGeo, polarMat)
    polarRing.rotation.y = Math.PI / 4
    astrolabe.add(polarRing)

    // E. Outer Astrolabe Graduation Tick Marks (16 cardinal & ordinal notches)
    const ticksCount = 16
    const tickPositions = new Float32Array(ticksCount * 6)
    const tickRadiusOuter = 101
    const tickRadiusInner = 95

    for (let i = 0; i < ticksCount; i++) {
      const angle = (i / ticksCount) * Math.PI * 2
      const cos = Math.cos(angle)
      const sin = Math.sin(angle)

      // Inner point
      tickPositions[i * 6] = cos * tickRadiusInner
      tickPositions[i * 6 + 1] = sin * tickRadiusInner
      tickPositions[i * 6 + 2] = 0

      // Outer point
      tickPositions[i * 6 + 3] = cos * tickRadiusOuter
      tickPositions[i * 6 + 4] = sin * tickRadiusOuter
      tickPositions[i * 6 + 5] = 0
    }

    const ticksGeo = new THREE.BufferGeometry()
    ticksGeo.setAttribute('position', new THREE.BufferAttribute(tickPositions, 3))
    const ticksMat = new THREE.LineBasicMaterial({
      color: currentPalette.ticksColor,
      transparent: true,
      opacity: currentPalette.ticksOpacity,
      blending: currentPalette.ringBlending,
    })
    const ticksMesh = new THREE.LineSegments(ticksGeo, ticksMat)
    astrolabe.add(ticksMesh)

    // F. Central Knowledge Core (Faceted Icosahedron + Inner Octahedron)
    const coreGroup = new THREE.Group()
    astrolabe.add(coreGroup)

    const icosaGeo = new THREE.IcosahedronGeometry(16, 0)
    const icosaMat = new THREE.MeshBasicMaterial({
      color: currentPalette.coreColor,
      wireframe: true,
      transparent: true,
      opacity: currentPalette.coreOpacity,
      blending: currentPalette.ringBlending,
    })
    const icosaMesh = new THREE.Mesh(icosaGeo, icosaMat)
    coreGroup.add(icosaMesh)

    const octaGeo = new THREE.OctahedronGeometry(8, 0)
    const octaMat = new THREE.MeshBasicMaterial({
      color: currentPalette.satelliteColor,
      wireframe: true,
      transparent: true,
      opacity: currentPalette.coreOpacity * 0.85,
      blending: currentPalette.ringBlending,
    })
    const octaMesh = new THREE.Mesh(octaGeo, octaMat)
    coreGroup.add(octaMesh)

    // G. Parametric Orbital Chronon Nodes (Travelling precisely along the ring paths)
    interface Chronon {
      mesh: THREE.Mesh
      ring: 'horizon' | 'meridian' | 'ecliptic' | 'polar'
      radius: number
      speed: number
      angle: number
    }

    const chronons: Chronon[] = []
    const sphereGeo = new THREE.SphereGeometry(1.6, 12, 12)
    const chrononMat = new THREE.MeshBasicMaterial({
      color: currentPalette.satelliteColor,
      transparent: true,
      opacity: currentPalette.satelliteOpacity,
      blending: currentPalette.ringBlending,
    })

    const chrononConfigs = [
      { ring: 'horizon' as const, radius: 98, speed: 0.32, angle: 0 },
      { ring: 'horizon' as const, radius: 98, speed: 0.32, angle: Math.PI },
      { ring: 'meridian' as const, radius: 82, speed: -0.45, angle: 0.8 },
      { ring: 'meridian' as const, radius: 82, speed: -0.45, angle: 0.8 + Math.PI },
      { ring: 'ecliptic' as const, radius: 68, speed: 0.58, angle: 0.4 },
      { ring: 'ecliptic' as const, radius: 68, speed: 0.58, angle: 0.4 + Math.PI },
      { ring: 'polar' as const, radius: 52, speed: -0.65, angle: 1.2 },
    ]

    chrononConfigs.forEach((cfg) => {
      const mesh = new THREE.Mesh(sphereGeo, chrononMat)
      astrolabe.add(mesh)
      chronons.push({
        mesh,
        ring: cfg.ring,
        radius: cfg.radius,
        speed: cfg.speed,
        angle: cfg.angle,
      })
    })

    // 5. Theme Switch Observer (Dynamically updates Three.js materials without re-instantiation)
    const updateThemeMaterials = (isLight: boolean) => {
      const p = isLight ? palette.light : palette.dark
      ringMaterials.forEach((m) => {
        m.color.setHex(p.ringColor)
        m.opacity = p.ringOpacity
        m.blending = p.ringBlending
        m.needsUpdate = true
      })
      ticksMat.color.setHex(p.ticksColor)
      ticksMat.opacity = p.ticksOpacity
      ticksMat.blending = p.ringBlending
      ticksMat.needsUpdate = true

      icosaMat.color.setHex(p.coreColor)
      icosaMat.opacity = p.coreOpacity
      icosaMat.blending = p.ringBlending
      icosaMat.needsUpdate = true

      octaMat.color.setHex(p.satelliteColor)
      octaMat.opacity = p.coreOpacity * 0.85
      octaMat.blending = p.ringBlending
      octaMat.needsUpdate = true

      chrononMat.color.setHex(p.satelliteColor)
      chrononMat.opacity = p.satelliteOpacity
      chrononMat.blending = p.ringBlending
      chrononMat.needsUpdate = true
    }

    const themeObserver = new MutationObserver(() => {
      const newIsLight = getTheme() === 'light'
      if (newIsLight !== isLightMode) {
        isLightMode = newIsLight
        updateThemeMaterials(newIsLight)
      }
    })
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })

    // 6. Interactive Parallax Tracking with Smooth Damping
    let targetRotX = 0.15
    let targetRotY = -0.2
    let currentRotX = 0.15
    let currentRotY = -0.2

    const handlePointerMove = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect()
      const normX = (e.clientX - rect.left) / rect.width - 0.5
      const normY = (e.clientY - rect.top) / rect.height - 0.5

      targetRotY = normX * 0.55
      targetRotX = -normY * 0.45
    }

    window.addEventListener('pointermove', handlePointerMove, { passive: true })

    // 7. Handle Resize
    const handleResize = () => {
      if (!container) return
      const w = container.clientWidth || window.innerWidth
      const h = container.clientHeight || window.innerHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
      updateAstrolabePosition()
    }

    window.addEventListener('resize', handleResize, { passive: true })

    // 8. Visibility and Frustum Management
    const handleVisibilityChange = () => {
      isVisible = !document.hidden
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry.isIntersecting
      },
      { threshold: 0.05 }
    )
    intersectionObserver.observe(container)

    // 9. Master Animation Loop (using THREE.Clock for consistent delta times)
    const clock = new THREE.Clock()

    const animate = () => {
      if (isVisible) {
        const delta = Math.min(clock.getDelta(), 0.1)
        const elapsed = clock.getElapsedTime()

        // Parallax Spring Damping
        currentRotX += (targetRotX - currentRotX) * (delta * 2.8)
        currentRotY += (targetRotY - currentRotY) * (delta * 2.8)

        astrolabe.rotation.x = currentRotX + Math.sin(elapsed * 0.3) * 0.04
        astrolabe.rotation.y = currentRotY + elapsed * 0.08

        // Subtle Counter-rotations on Individual Gyroscope Gimbal Rings
        horizonRing.rotation.z += delta * 0.06
        meridianRing.rotation.z += delta * 0.09
        eclipticRing.rotation.z += delta * 0.12
        polarRing.rotation.z -= delta * 0.08
        ticksMesh.rotation.z = horizonRing.rotation.z

        // Knowledge Core Multi-axis Rotation & Gentle Breathing
        icosaMesh.rotation.x += delta * 0.25
        icosaMesh.rotation.y += delta * 0.35
        octaMesh.rotation.x -= delta * 0.4
        octaMesh.rotation.z += delta * 0.3

        const breathScale = 1 + Math.sin(elapsed * 1.5) * 0.05
        coreGroup.scale.set(breathScale, breathScale, breathScale)

        // Orbital Chronon Nodes Movement along Ring Paths
        chronons.forEach((c) => {
          c.angle += c.speed * delta
          const cos = Math.cos(c.angle) * c.radius
          const sin = Math.sin(c.angle) * c.radius

          const pos = new THREE.Vector3()
          if (c.ring === 'horizon') {
            pos.set(cos, sin, 0).applyEuler(horizonRing.rotation)
          } else if (c.ring === 'meridian') {
            pos.set(cos, 0, sin).applyEuler(meridianRing.rotation)
          } else if (c.ring === 'ecliptic') {
            pos.set(cos, sin, 0).applyEuler(eclipticRing.rotation)
          } else {
            pos.set(cos, sin, 0).applyEuler(polarRing.rotation)
          }
          c.mesh.position.copy(pos)
        })

        renderer.render(scene, camera)
      }

      animationFrameId = requestAnimationFrame(animate)
    }

    animate()

    // 10. Complete Resource Disposal on Unmount
    return () => {
      cancelAnimationFrame(animationFrameId)
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('resize', handleResize)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      themeObserver.disconnect()
      intersectionObserver.disconnect()

      horizonGeo.dispose()
      meridianGeo.dispose()
      eclipticGeo.dispose()
      polarGeo.dispose()
      ticksGeo.dispose()
      icosaGeo.dispose()
      octaGeo.dispose()
      sphereGeo.dispose()

      ringMaterials.forEach((m) => m.dispose())
      ticksMat.dispose()
      icosaMat.dispose()
      octaMat.dispose()
      chrononMat.dispose()
      renderer.dispose()

      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className={`ambient-canvas-container ${className}`}
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 0,
      }}
      aria-hidden="true"
    />
  )
}
